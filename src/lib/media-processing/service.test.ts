import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import {
  requestMediaReprocess,
  runVideoProcessing,
} from './service'
import type { ProcessedVideo } from './video'

type RecordState = Record<string, unknown> | null

const matchesWhere = (record: Record<string, unknown>, where: Record<string, unknown>) =>
  (where.and as Array<Record<string, Record<string, unknown>>>).every((condition) => {
    const [field, comparison] = Object.entries(condition)[0]
    if ('equals' in comparison) return record[field] === comparison.equals
    if ('in' in comparison) return (comparison.in as unknown[]).includes(record[field])
    return false
  })

const fakePayload = (initial: RecordState) => {
  let record = initial
  const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
  const payload = {
    logger,
    db: {
      updateOne: vi.fn(async (options: Record<string, unknown>) => {
        const where = options.where as Record<string, unknown>
        if (!record || !matchesWhere(record, where)) return null
        record = { ...record, ...(options.data as Record<string, unknown>) }
        return { ...record }
      }),
    },
    findByID: vi.fn(async () => {
      if (!record) {
        const error = new Error('not found')
        error.name = 'NotFound'
        throw error
      }
      return { ...record }
    }),
    update: vi.fn(async (options: Record<string, unknown>) => {
      if ('id' in options) {
        if (!record || record.id !== options.id) return null
        record = { ...record, ...(options.data as Record<string, unknown>) }
        return { ...record }
      }

      return { docs: [] }
    }),
  }

  return {
    payload: payload as unknown as Payload,
    record: () => record,
    replace: (next: RecordState) => { record = next },
  }
}

const readyDerivatives = {
  playbackFilename: 'generated/7/r1/playback.mp4',
  playbackUrl: '/api/media/7/playback',
  playbackMimeType: 'video/mp4',
  posterFilename: 'generated/7/r1/poster.jpg',
  posterUrl: '/api/media/7/poster',
  posterMimeType: 'image/jpeg',
}

const processed: ProcessedVideo = {
  duration: 2,
  width: 640,
  height: 480,
  rotation: 0,
  hasAudio: false,
  frameRate: 30,
  streamCount: 1,
  formatName: 'mov,mp4,m4a,3gp,3g2,mj2',
  playbackFilename: 'generated/7/r2/playback.mp4',
  playbackMimeType: 'video/mp4',
  playbackFilesize: 100,
  posterFilename: 'generated/7/r2/poster.jpg',
  posterMimeType: 'image/jpeg',
  posterWidth: 640,
  posterHeight: 480,
  transitionColor: '#123456',
}

const pendingVideo = () => ({
  id: 7,
  kind: 'video',
  filename: 'source.mov',
  processingRevision: 2,
  processingStatus: 'pending',
  ...readyDerivatives,
})

describe('atomic video processing publication', () => {
  it('does not process stale revisions', async () => {
    const state = fakePayload(pendingVideo())
    const processVideoFn = vi.fn()

    await expect(runVideoProcessing(state.payload, 7, 1, {
      processVideoFn,
    })).resolves.toBe('stale')
    expect(processVideoFn).not.toHaveBeenCalled()
  })

  it('publishes the current revision before cleaning only prior derivatives', async () => {
    const state = fakePayload(pendingVideo())
    const cleanupFn = vi.fn(async () => [])

    await expect(runVideoProcessing(state.payload, 7, 2, {
      processVideoFn: async () => processed,
      cleanupFn,
    })).resolves.toBe('ready')

    expect(state.record()).toMatchObject({
      processingStatus: 'ready',
      processingRevision: 2,
      playbackFilename: processed.playbackFilename,
      posterFilename: processed.posterFilename,
    })
    expect(cleanupFn).toHaveBeenCalledWith(
      state.payload,
      expect.objectContaining(readyDerivatives),
      [processed.playbackFilename, processed.posterFilename],
    )
  })

  it.each(['replaced', 'deleted'] as const)(
    'removes generated files when the record is %s before publication',
    async (outcome) => {
      const state = fakePayload(pendingVideo())
      const cleanupFn = vi.fn(async () => [])
      const processVideoFn = vi.fn(async () => {
        state.replace(outcome === 'deleted'
          ? null
          : { ...pendingVideo(), processingRevision: 3, processingStatus: 'pending' })
        return processed
      })

      await expect(runVideoProcessing(state.payload, 7, 2, {
        processVideoFn,
        cleanupFn,
      })).resolves.toBe('stale')
      expect(cleanupFn).toHaveBeenCalledWith(
        state.payload,
        expect.objectContaining({
          playbackFilename: processed.playbackFilename,
          posterFilename: processed.posterFilename,
        }),
      )
    },
  )

  it('removes generated files when the final database update throws', async () => {
    const state = fakePayload(pendingVideo())
    const cleanupFn = vi.fn(async () => [])
    const updateOne = state.payload.db.updateOne.bind(state.payload.db)
    let conditionalUpdates = 0
    state.payload.db.updateOne = vi.fn(async (options) => {
      conditionalUpdates += 1
      if (conditionalUpdates === 2) throw new Error('database unavailable')
      return updateOne(options)
    }) as Payload['db']['updateOne']

    await expect(runVideoProcessing(state.payload, 7, 2, {
      processVideoFn: async () => processed,
      cleanupFn,
    })).rejects.toThrow('database unavailable')
    expect(cleanupFn).toHaveBeenCalledWith(
      state.payload,
      expect.objectContaining({
        playbackFilename: processed.playbackFilename,
        posterFilename: processed.posterFilename,
      }),
    )
  })

  it('preserves published derivatives when replacement processing fails', async () => {
    const state = fakePayload(pendingVideo())
    const failure = new Error('transcode failed')

    await expect(runVideoProcessing(state.payload, 7, 2, {
      processVideoFn: async () => { throw failure },
    })).rejects.toThrow('transcode failed')

    expect(state.record()).toMatchObject({
      processingStatus: 'failed',
      processingRevision: 2,
      ...readyDerivatives,
    })
  })
})

describe('video reprocess queueing', () => {
  it('returns a stable conflict without incrementing an active revision', async () => {
    const state = fakePayload(pendingVideo())
    const queueFn = vi.fn()

    await expect(requestMediaReprocess(state.payload, 7, undefined, {
      queueFn,
    })).resolves.toEqual({
      kind: 'video',
      status: 'already-processing',
      revision: 2,
    })
    expect(queueFn).not.toHaveBeenCalled()
    expect(state.record()?.processingRevision).toBe(2)
  })

  it('marks only the queued revision failed when queueing fails', async () => {
    const state = fakePayload({
      ...pendingVideo(),
      processingStatus: 'ready',
    })

    await expect(requestMediaReprocess(state.payload, 7, undefined, {
      queueFn: async () => { throw new Error('queue unavailable') },
    })).resolves.toEqual({
      kind: 'video',
      status: 'queue-failed',
      revision: 3,
    })
    expect(state.record()).toMatchObject({
      processingStatus: 'failed',
      processingRevision: 3,
      ...readyDerivatives,
    })
  })
})
