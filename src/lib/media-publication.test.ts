import { describe, expect, it } from 'vitest'
import {
  mediaAdminThumbnail,
  privateVideoOriginalHandler,
  redactPrivateVideoOriginal,
  videoDerivativeURL,
} from './media-publication'
import type { PayloadRequest } from 'payload'

describe('media admin thumbnail', () => {
  it('uses the image card size URL', () => {
    expect(mediaAdminThumbnail({
      doc: { kind: 'image', sizes: { card: { url: '/api/media/file/card.jpg' } } },
    })).toBe('/api/media/file/card.jpg')
  })

  it('uses the controlled poster endpoint only for published video derivatives', () => {
    expect(mediaAdminThumbnail({
      doc: {
        id: 9,
        kind: 'video',
        processingStatus: 'failed',
        playbackFilename: 'generated/9/r1/playback.mp4',
        playbackUrl: videoDerivativeURL(9, 'playback'),
        posterFilename: 'generated/9/r1/poster.jpg',
        posterUrl: videoDerivativeURL(9, 'poster'),
      },
    })).toBe('/api/media/9/poster')
    expect(mediaAdminThumbnail({
      doc: { id: 10, kind: 'video', processingStatus: 'pending' },
    })).toBe(false)
  })
})

describe('video original privacy', () => {
  const video = {
    id: 3,
    kind: 'video',
    mimeType: 'video/quicktime',
    filename: 'candidate.mov',
    url: '/api/media/file/candidate.mov',
  }

  it('returns a generic 404 for anonymous video-original requests', async () => {
    const response = privateVideoOriginalHandler(
      { user: null } as unknown as PayloadRequest,
      { doc: video },
    )
    expect(response?.status).toBe(404)
    await expect(response?.json()).resolves.toEqual({ error: 'Not found' })
  })

  it('allows images and authenticated administrators through to Payload', () => {
    const image = { id: 4, kind: 'image', filename: 'photo.jpg' }
    expect(privateVideoOriginalHandler(
      { user: null } as unknown as PayloadRequest,
      { doc: image },
    )).toBeUndefined()
    expect(privateVideoOriginalHandler(
      { user: { id: 1 } } as unknown as PayloadRequest,
      { doc: video },
    )).toBeUndefined()
  })

  it('redacts only anonymous video original identity', () => {
    expect(redactPrivateVideoOriginal(video, false)).toMatchObject({
      filename: null,
      url: null,
    })
    expect(redactPrivateVideoOriginal(video, true)).toBe(video)
    const image = { id: 4, kind: 'image', filename: 'photo.jpg', url: '/photo.jpg' }
    expect(redactPrivateVideoOriginal(image, false)).toBe(image)
  })
})
