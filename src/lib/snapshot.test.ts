import { describe, expect, it } from 'vitest'
import {
  documentsById,
  normalizeSnapshotMedia,
  normalizeSnapshotPhotoshoot,
  type SnapshotDocument,
} from './snapshot'

describe('static snapshot media normalization', () => {
  it('retains published video metadata without exposing the private original', () => {
    const photoshoots = documentsById([
      { id: 4, title: 'Motion', slug: 'motion', photographers: [8] },
    ])
    const photographers = documentsById([
      { id: 8, displayName: 'A. Camera' },
    ])
    const media = normalizeSnapshotMedia({
      id: 2,
      filename: 'clip.mov',
      mimeType: 'video/quicktime',
      filesize: 400,
      photoshoot: 4,
      transitionColor: '#AABBCC',
      kind: 'video',
      processingStatus: 'ready',
      processingRevision: 3,
      duration: 4.2,
      videoWidth: 1080,
      videoHeight: 1920,
      playbackFilename: 'generated/2/r3/playback.mp4',
      playbackMimeType: 'video/mp4',
      playbackFilesize: 300,
      posterFilename: 'generated/2/r3/poster.jpg',
      posterMimeType: 'image/jpeg',
      posterWidth: 1080,
      posterHeight: 1920,
    } satisfies SnapshotDocument, photoshoots, photographers)

    expect(media).toMatchObject({
      filename: null,
      url: null,
      transitionColor: '#aabbcc',
      photoshoot: {
        id: 4,
        slug: 'motion',
        photographers: [{ id: 8, displayName: 'A. Camera' }],
      },
      playbackUrl: '/media/generated/2/r3/playback.mp4',
      posterUrl: '/media/generated/2/r3/poster.jpg',
      duration: 4.2,
      videoWidth: 1080,
      videoHeight: 1920,
    })
    expect(media).not.toHaveProperty('photographers')
    expect(normalizeSnapshotPhotoshoot(4, photoshoots, photographers)).toMatchObject({
      id: 4,
      photographers: [{ id: 8, displayName: 'A. Camera' }],
    })
  })
})
