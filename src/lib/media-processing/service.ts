import { rm, rmdir } from 'node:fs/promises'
import path from 'node:path'
import type { Payload, PayloadRequest, Where } from 'payload'
import { videoDerivativeURL } from '../media-publication'
import { deriveTransitionColor } from './color'
import {
  MEDIA_STATIC_DIR,
  resolveContainedMediaPath,
  resolveOwnedDerivativePath,
} from './paths'
import { MEDIA_PROCESSING_CONTEXT } from './state'
import { processVideo, type ProcessedVideo } from './video'

export const MEDIA_PROCESSING_QUEUE = 'media-processing'

const processingContext = { [MEDIA_PROCESSING_CONTEXT]: true }
const mediaFilePath = (filename: string) =>
  resolveContainedMediaPath(filename, MEDIA_STATIC_DIR)

type StoredMedia = {
  id: number
  kind?: 'image' | 'video' | null
  processingRevision?: number | null
  processingStatus?: 'pending' | 'processing' | 'ready' | 'failed' | null
  processingError?: string | null
  filename?: string | null
  transitionColor?: string | null
  playbackFilename?: string | null
  posterFilename?: string | null
}

type ProcessVideoFunction = typeof processVideo

const safeProcessingError = (error: unknown) => {
  const message = (error instanceof Error ? error.message : String(error))
    .replace(/[\r\n\t]+/g, ' ')
    .replaceAll(MEDIA_STATIC_DIR, '[media]')
    .replace(/\s+/g, ' ')
    .trim()
  return (message || 'Media processing failed').slice(0, 1_000)
}

const logCleanupFailure = (
  payload: Pick<Payload, 'logger'>,
  mediaId: number,
  error: unknown,
) => {
  payload.logger.error(
    `Generated media cleanup failed for media ${mediaId}: ${safeProcessingError(error)}`,
  )
}

export async function removeVideoDerivatives(
  payload: Pick<Payload, 'logger'>,
  media: Pick<StoredMedia, 'id' | 'playbackFilename' | 'posterFilename'>,
  except: string[] = [],
) {
  const keep = new Set(except)
  const targets = [
    { filename: media.playbackFilename, kind: 'playback' as const },
    { filename: media.posterFilename, kind: 'poster' as const },
  ].filter(({ filename }) => filename && !keep.has(filename))
  const failures: Error[] = []

  for (const { filename, kind } of targets) {
    try {
      const owned = resolveOwnedDerivativePath(
        filename!,
        media.id,
        kind,
        MEDIA_STATIC_DIR,
      )
      await rm(owned.absolutePath, { force: true })
      await rmdir(path.dirname(owned.absolutePath)).catch((error) => {
        const code = (error as NodeJS.ErrnoException).code
        if (code !== 'ENOENT' && code !== 'ENOTEMPTY') throw error
      })
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error))
      failures.push(normalized)
      logCleanupFailure(payload, media.id, normalized)
    }
  }

  return failures
}

type QueuePayload = {
  jobs: {
    queue: (args: {
      task: 'processVideo'
      queue: string
      input: { mediaId: number; revision: number }
      overrideAccess: boolean
      req?: PayloadRequest
    }) => Promise<unknown>
  }
}

export async function queueVideoProcessing(
  payload: Payload,
  mediaId: number,
  revision: number,
  req?: PayloadRequest,
) {
  await (payload as Payload & QueuePayload).jobs.queue({
    task: 'processVideo',
    queue: MEDIA_PROCESSING_QUEUE,
    input: { mediaId, revision },
    overrideAccess: true,
    req,
  })
}

type CASOptions = {
  statuses?: Array<'pending' | 'processing' | 'ready' | 'failed'>
  req?: Partial<PayloadRequest>
}

export async function compareAndSwapVideoRevision(
  payload: Payload,
  mediaId: number,
  revision: number,
  data: Record<string, unknown>,
  options: CASOptions = {},
) {
  const and: Where[] = [
    { id: { equals: mediaId } },
    { kind: { equals: 'video' } },
    { processingRevision: { equals: revision } },
  ]
  if (options.statuses?.length) {
    and.push({ processingStatus: { in: options.statuses } })
  }

  const result = await payload.db.updateOne({
    collection: 'media',
    where: { and },
    data: {
      ...data,
      updatedAt: new Date().toISOString(),
    },
    returning: true,
    req: options.req,
  })
  return (result || undefined) as StoredMedia | undefined
}

export async function markCurrentRevisionFailed(
  payload: Payload,
  mediaId: number,
  revision: number,
  error: unknown,
  req?: Partial<PayloadRequest>,
) {
  return compareAndSwapVideoRevision(
    payload,
    mediaId,
    revision,
    {
      processingStatus: 'failed',
      processingError: safeProcessingError(error),
    },
    { statuses: ['pending', 'processing'], req },
  )
}

export async function deriveAndPersistImageColor(
  payload: Payload,
  media: Pick<StoredMedia, 'id' | 'filename' | 'transitionColor'>,
) {
  const transitionColor = media.filename
    ? await deriveTransitionColor(mediaFilePath(media.filename))
    : null

  if (transitionColor === media.transitionColor) return transitionColor

  await payload.update({
    collection: 'media',
    id: media.id,
    data: { transitionColor },
    context: processingContext,
    overrideAccess: true,
  })
  return transitionColor
}

type ProcessingDependencies = {
  processVideoFn?: ProcessVideoFunction
  cleanupFn?: typeof removeVideoDerivatives
}

export async function runVideoProcessing(
  payload: Payload,
  mediaId: number,
  revision: number,
  dependencies: ProcessingDependencies = {},
) {
  const processVideoFn = dependencies.processVideoFn || processVideo
  const cleanupFn = dependencies.cleanupFn || removeVideoDerivatives
  const started = await compareAndSwapVideoRevision(
    payload,
    mediaId,
    revision,
    { processingStatus: 'processing', processingError: null },
    { statuses: ['pending'] },
  )
  if (!started) return 'stale' as const
  if (!started.filename) {
    const error = new Error('Video record has no original filename')
    await markCurrentRevisionFailed(payload, mediaId, revision, error)
    throw error
  }

  let processed: ProcessedVideo | null = null
  let databasePublished = false
  let processingFailure: unknown

  try {
    processed = await processVideoFn({
      inputPath: mediaFilePath(started.filename),
      mediaId,
      revision,
      mediaRoot: MEDIA_STATIC_DIR,
    })

    const published = await compareAndSwapVideoRevision(
      payload,
      mediaId,
      revision,
      {
        processingStatus: 'ready',
        processingError: null,
        duration: processed.duration,
        videoWidth: processed.width,
        videoHeight: processed.height,
        playbackFilename: processed.playbackFilename,
        playbackUrl: videoDerivativeURL(mediaId, 'playback', revision),
        playbackMimeType: processed.playbackMimeType,
        playbackFilesize: processed.playbackFilesize,
        posterFilename: processed.posterFilename,
        posterUrl: videoDerivativeURL(mediaId, 'poster', revision),
        posterMimeType: processed.posterMimeType,
        posterWidth: processed.posterWidth,
        posterHeight: processed.posterHeight,
        transitionColor: processed.transitionColor,
      },
      { statuses: ['processing'] },
    )
    if (!published) return 'stale' as const

    databasePublished = true
    await cleanupFn(payload, started, [
      processed.playbackFilename,
      processed.posterFilename,
    ])
    return 'ready' as const
  } catch (error) {
    processingFailure = error
    try {
      await markCurrentRevisionFailed(payload, mediaId, revision, error)
    } catch (statusError) {
      throw new AggregateError(
        [error, statusError],
        'Video processing failed and its status could not be persisted',
      )
    }
    throw error
  } finally {
    if (processed && !databasePublished) {
      const failures = await cleanupFn(payload, {
        id: mediaId,
        playbackFilename: processed.playbackFilename,
        posterFilename: processed.posterFilename,
      })
      if (failures.length && !processingFailure) {
        throw new AggregateError(failures, 'Unpublished derivative cleanup failed')
      }
    }
  }
}

type ReprocessDependencies = {
  queueFn?: typeof queueVideoProcessing
}

export async function requestMediaReprocess(
  payload: Payload,
  mediaId: number,
  req?: PayloadRequest,
  dependencies: ReprocessDependencies = {},
) {
  const queueFn = dependencies.queueFn || queueVideoProcessing
  const media = await payload.findByID({
    collection: 'media',
    id: mediaId,
    depth: 0,
    overrideAccess: true,
    req,
  }) as StoredMedia

  if (media.kind !== 'video') {
    await deriveAndPersistImageColor(payload, media)
    return { kind: 'image' as const, status: 'ready' as const }
  }
  if (media.processingStatus === 'pending' || media.processingStatus === 'processing') {
    return {
      kind: 'video' as const,
      status: 'already-processing' as const,
      revision: media.processingRevision || 0,
    }
  }

  const currentRevision = media.processingRevision || 0
  const revision = currentRevision + 1
  const pending = await compareAndSwapVideoRevision(
    payload,
    mediaId,
    currentRevision,
    {
      processingRevision: revision,
      processingStatus: 'pending',
      processingError: null,
    },
    { statuses: ['ready', 'failed'], req },
  )
  if (!pending) {
    return { kind: 'video' as const, status: 'already-processing' as const, revision }
  }

  try {
    await queueFn(payload, mediaId, revision, req)
    return { kind: 'video' as const, status: 'pending' as const, revision }
  } catch (error) {
    await markCurrentRevisionFailed(payload, mediaId, revision, error, req)
    return { kind: 'video' as const, status: 'queue-failed' as const, revision }
  }
}
