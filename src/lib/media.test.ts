import { describe, expect, it } from 'vitest'
import {
  inferMediaKind,
  hasPublishedVideoDerivatives,
  isUsableMedia,
  mediaDimensions,
  mediaPosterUrl,
  mediaPresentationUrl,
  mediaStatus,
  normalizeMediaLike,
  readinessKindForMedia,
} from './media'

describe('canonical media model', () => {
  it('keeps legacy images ready and usable', () => {
    const image = { url: '/media/photo.jpg', width: 1200, height: 800 }

    expect(inferMediaKind(image)).toBe('image')
    expect(mediaStatus(image)).toBe('ready')
    expect(mediaPresentationUrl(image)).toBe('/media/photo.jpg')
    expect(mediaDimensions(image)).toEqual({ width: 1200, height: 800 })
    expect(isUsableMedia(image)).toBe(true)
  })

  it('exposes published video derivatives across replacement states', () => {
    const video = {
      kind: 'video' as const,
      url: '/media/original.mov',
      playbackUrl: '/media/movie.mp4',
      playbackFilename: 'generated/1/r1/playback.mp4',
      posterUrl: '/media/movie.jpg',
      posterFilename: 'generated/1/r1/poster.jpg',
      processingStatus: 'ready' as const,
      videoWidth: 1080,
      videoHeight: 1920,
    }

    expect(mediaPresentationUrl(video)).toBe('/media/movie.mp4')
    expect(mediaPosterUrl(video)).toBe('/media/movie.jpg')
    expect(mediaDimensions(video)).toEqual({ width: 1080, height: 1920 })
    expect(isUsableMedia(video)).toBe(true)
    expect(readinessKindForMedia(video)).toBe('canplay')
    expect(readinessKindForMedia({ url: '/media/photo.jpg' })).toBe('decode')
    expect(isUsableMedia({ ...video, processingStatus: 'failed' })).toBe(true)
    expect(isUsableMedia({ ...video, processingStatus: 'pending' })).toBe(true)
    expect(hasPublishedVideoDerivatives(video)).toBe(true)
    expect(isUsableMedia({ ...video, posterUrl: null })).toBe(false)
    expect(isUsableMedia({
      kind: 'video',
      processingStatus: 'failed',
      url: '/media/new.mov',
    })).toBe(false)
  })

  it('normalizes expanded photographers and static derivative URLs', () => {
    const normalized = normalizeMediaLike(
      {
        id: 4,
        filename: 'original.mov',
        mimeType: 'video/quicktime',
        photographers: [
          { id: 1, displayName: '  Alex Smith  ' },
          2,
          { id: 3, displayName: '' },
        ],
        playbackFilename: 'generated/4/r2/playback.mp4',
        posterFilename: 'generated/4/r2/poster.jpg',
        processingStatus: 'ready',
      },
      { urlForFilename: (filename) => `/media/${filename}` },
    )

    expect(normalized).toMatchObject({
      kind: 'video',
      filename: null,
      url: null,
      playbackUrl: '/media/generated/4/r2/playback.mp4',
      posterUrl: '/media/generated/4/r2/poster.jpg',
      photographers: [{ id: 1, displayName: '  Alex Smith  ' }, 2],
    })
  })
})
