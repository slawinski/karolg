import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { serveMediaDerivative } from './derivative-response'
import { derivativeRelativePath } from './paths'

describe('anonymous generated derivative responses', () => {
  let mediaRoot: string
  let document: Record<string, unknown>
  const payload = {
    findByID: async () => document,
  }

  beforeEach(async () => {
    mediaRoot = await mkdtemp(path.join(tmpdir(), 'karolg-derivative-'))
    const playbackFilename = derivativeRelativePath(7, 2, 'playback')
    const posterFilename = derivativeRelativePath(7, 2, 'poster')
    await mkdir(path.dirname(path.join(mediaRoot, playbackFilename)), { recursive: true })
    await writeFile(path.join(mediaRoot, playbackFilename), '0123456789')
    await writeFile(path.join(mediaRoot, posterFilename), 'jpeg')
    document = {
      id: 7,
      kind: 'video',
      processingStatus: 'ready',
      playbackFilename,
      playbackUrl: '/api/media/7/playback',
      playbackMimeType: 'video/mp4',
      posterFilename,
      posterUrl: '/api/media/7/poster',
    }
  })

  afterEach(async () => {
    await rm(mediaRoot, { recursive: true, force: true })
  })

  it('serves retained derivatives anonymously for failed replacements', async () => {
    document.processingStatus = 'failed'
    const response = await serveMediaDerivative({
      payload,
      request: new Request('http://test/api/media/7/poster'),
      rawId: '7',
      kind: 'poster',
      mediaRoot,
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(await response.text()).toBe('jpeg')
  })

  it('supports a valid single video range and HEAD', async () => {
    const range = await serveMediaDerivative({
      payload,
      request: new Request('http://test/api/media/7/playback', {
        headers: { range: 'bytes=2-5' },
      }),
      rawId: '7',
      kind: 'playback',
      mediaRoot,
    })
    expect(range.status).toBe(206)
    expect(range.headers.get('content-range')).toBe('bytes 2-5/10')
    expect(range.headers.get('accept-ranges')).toBe('bytes')
    expect(range.headers.get('content-length')).toBe('4')
    expect(await range.text()).toBe('2345')

    const head = await serveMediaDerivative({
      payload,
      request: new Request('http://test/api/media/7/playback', { method: 'HEAD' }),
      rawId: '7',
      kind: 'playback',
      mediaRoot,
    })
    expect(head.status).toBe(200)
    expect(head.headers.get('content-length')).toBe('10')
    expect(await head.text()).toBe('')
  })

  it('returns stable 404/416 responses without leaking paths', async () => {
    document = { id: 7, kind: 'video', processingStatus: 'pending' }
    const denied = await serveMediaDerivative({
      payload,
      request: new Request('http://test/api/media/7/playback'),
      rawId: '7',
      kind: 'playback',
      mediaRoot,
    })
    expect(denied.status).toBe(404)
    expect(await denied.text()).not.toContain(mediaRoot)

    document = {
      ...document,
      playbackFilename: '../secret.mp4',
      playbackUrl: '/api/media/7/playback',
      posterFilename: derivativeRelativePath(7, 2, 'poster'),
      posterUrl: '/api/media/7/poster',
    }
    const traversal = await serveMediaDerivative({
      payload,
      request: new Request('http://test/api/media/7/playback'),
      rawId: '7',
      kind: 'playback',
      mediaRoot,
    })
    expect(traversal.status).toBe(404)

    document = {
      id: 7,
      kind: 'video',
      processingStatus: 'ready',
      playbackFilename: derivativeRelativePath(7, 2, 'playback'),
      playbackUrl: '/api/media/7/playback',
      playbackMimeType: 'video/mp4',
      posterFilename: derivativeRelativePath(7, 2, 'poster'),
      posterUrl: '/api/media/7/poster',
    }
    const invalidRange = await serveMediaDerivative({
      payload,
      request: new Request('http://test/api/media/7/playback', {
        headers: { range: 'bytes=99-100' },
      }),
      rawId: '7',
      kind: 'playback',
      mediaRoot,
    })
    expect(invalidRange.status).toBe(416)
    expect(invalidRange.headers.get('content-range')).toBe('bytes */10')
  })
})
