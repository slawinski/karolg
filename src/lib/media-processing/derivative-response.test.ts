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

  it.each(['playback', 'poster'] as const)('binds immutable %s responses to a single matching published revision', async (kind) => {
    for (const method of ['GET', 'HEAD']) {
      for (const range of [undefined, 'bytes=0-1']) {
        const response = await serveMediaDerivative({ payload, request: new Request(`http://test/api/media/7/${kind}?v=2`, { method, headers: range ? { range } : {} }), rawId: '7', kind, mediaRoot })
        expect(response.status).toBe(range ? 206 : 200)
        expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
        expect(await response.text()).toBe(method === 'HEAD' ? '' : range ? (kind === 'poster' ? 'jp' : '01') : kind === 'poster' ? 'jpeg' : '0123456789')
      }
    }
  })

  it.each(['pending', 'processing', 'failed'])('serves matching retained revisions while %s', async (processingStatus) => {
    document.processingStatus = processingStatus
    document.processingRevision = 3
    const response = await serveMediaDerivative({ payload, request: new Request('http://test/api/media/7/playback?v=2'), rawId: '7', kind: 'playback', mediaRoot })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(await response.text()).toBe('0123456789')
  })

  it.each([
    ['generated/8/r2/playback.mp4', 2],
    ['generated/7/r2/poster.jpg', 2],
    ['generated/7/r9/playback.mp4', 9],
  ])('rejects cross-owned, wrong-kind, or unavailable path %s', async (playbackFilename, revision) => {
    document.playbackFilename = playbackFilename
    const response = await serveMediaDerivative({ payload, request: new Request(`http://test/api/media/7/playback?v=${revision}`), rawId: '7', kind: 'playback', mediaRoot })
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.text()).not.toContain(mediaRoot)
  })

  it.each(['v=1', 'v=3', 'v=2&v=2', 'v=', 'v=02', 'v=-2', 'v=2.0', 'v=9007199254740992', 'v=../r2'])('rejects invalid identity %s without caching errors', async (query) => {
    const response = await serveMediaDerivative({ payload, request: new Request(`http://test/api/media/7/playback?${query}`), rawId: '7', kind: 'playback', mediaRoot })
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.text()).not.toContain('0123456789')
  })

  it('never resolves a retired version to newly published bytes', async () => {
    await rm(path.join(mediaRoot, 'generated/7/r2'), { recursive: true })
    await mkdir(path.join(mediaRoot, 'generated/7/r3'), { recursive: true })
    await writeFile(path.join(mediaRoot, 'generated/7/r3/playback.mp4'), 'new revision')
    document.playbackFilename = 'generated/7/r3/playback.mp4'
    const response = await serveMediaDerivative({ payload, request: new Request('http://test/api/media/7/playback?v=2'), rawId: '7', kind: 'playback', mediaRoot })
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const current = await serveMediaDerivative({ payload, request: new Request('http://test/api/media/7/playback?v=3'), rawId: '7', kind: 'playback', mediaRoot })
    expect(await current.text()).toBe('new revision')
    expect(current.headers.get('cache-control')).toContain('immutable')
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
    expect(response.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate')
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
    expect(denied.headers.get('cache-control')).toBe('no-store')
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
    expect(invalidRange.headers.get('cache-control')).toBe('no-store')
    expect(invalidRange.headers.get('content-range')).toBe('bytes */10')
  })
})
