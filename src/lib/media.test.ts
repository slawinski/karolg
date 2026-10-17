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
} from './media'

describe('canonical media model', () => {
  it('versions image identities idempotently while preserving other URL parts', () => {
    const image = { id: 7, url: '/api/media/file/portrait.jpg?size=card&v=old#photo', processingRevision: 2 }
    expect(mediaPresentationUrl(image)).toBe('/api/media/file/portrait.jpg?size=card&v=2#photo')
    const normalized = normalizeMediaLike(image)
    expect(normalizeMediaLike(normalized)).toEqual(normalized)
    expect(normalized?.url).toBe(mediaPresentationUrl(image))
    expect(mediaPresentationUrl({ ...image, processingRevision: 3 })).not.toBe(mediaPresentationUrl(image))
  })

  it.each([undefined, null, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('leaves invalid image revision %s unversioned', (processingRevision) => {
    expect(mediaPresentationUrl({ url: '/photo.jpg', processingRevision })).toBe('/photo.jpg')
    expect(mediaPresentationUrl({ processingRevision })).toBeNull()
  })

  it.each(['pending', 'processing', 'failed', 'ready'] as const)('uses published filenames rather than active revisions while %s', (processingStatus) => {
    const video = { id: 7, kind: 'video' as const, processingRevision: 3, processingStatus,
      playbackFilename: 'generated/7/r2/playback.mp4', playbackUrl: '/api/media/7/playback',
      posterFilename: 'generated/7/r2/poster.jpg', posterUrl: '/api/media/7/poster' }
    expect(mediaPresentationUrl(video)).toBe('/api/media/7/playback?v=2')
    expect(mediaPosterUrl(video)).toBe('/api/media/7/poster?v=2')
    expect(normalizeMediaLike(video)).toMatchObject({ playbackUrl: '/api/media/7/playback?v=2', posterUrl: '/api/media/7/poster?v=2', url: null, filename: null })
    expect(mediaPosterUrl({ ...video, posterFilename: 'generated/8/r2/poster.jpg' })).toBe('/api/media/7/poster')
  })
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

  it('normalizes photoshoot photographers and static derivative URLs', () => {
    const normalized = normalizeMediaLike(
      {
        id: 4,
        filename: 'original.mov',
        mimeType: 'video/quicktime',
        photographers: [99],
        photoshoot: {
          id: 7,
          title: 'Movement',
          slug: 'movement',
          photographers: [
            { id: 1, displayName: '  Alex Smith  ' },
            2,
            { id: 3, displayName: '' },
          ],
        },
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
      photoshoot: {
        id: 7,
        photographers: [{ id: 1, displayName: '  Alex Smith  ' }, 2],
      },
    })
    expect(normalized).not.toHaveProperty('photographers')
  })
})
