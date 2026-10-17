import type { MediaLike } from '@/lib/media'

// Public /work/A document retained before rebuilding .next, 2026-10-17.
// Intrinsic dimensions are intentionally absent: the gallery uses slot ratios.
export const regressionPhotoshoot = {
  title: 'A',
  filenames: [
    'IMG_3814.JPG', 'IMG_3815.JPG', 'IMG_3831.JPG', 'IMG_3834.JPG',
    'IMG_3906.JPG', 'IMG_3912.JPG', 'IMG_3916.JPG', 'IMG_3926.JPG', 'IMG_3988.JPG',
  ],
}

export const regressionMedia: MediaLike[] = regressionPhotoshoot.filenames.map((filename) => ({
  id: filename,
  kind: 'image',
  filename,
  url: `/api/media/file/${filename}`,
}))

export const controlledMedia = (count: number): MediaLike[] => Array.from({ length: count }, (_, index) => ({
  id: `still-${index}`,
  kind: 'image',
  url: `/__controlled__/still-${index}.jpg`,
}))

export const controlledVideo: MediaLike = {
  id: 'video', kind: 'video', processingStatus: 'ready',
  playbackFilename: 'clip.mp4', playbackUrl: '/__controlled__/clip.mp4',
  posterFilename: 'poster.jpg', posterUrl: '/__controlled__/poster.jpg',
}

export const candidateViewports = [
  { width: 390, height: 844, dpr: 2 },
  { width: 390, height: 600, dpr: 2 },
  { width: 390, height: 1000, dpr: 2 },
  { width: 900, height: 900, dpr: 2 },
  { width: 1440, height: 900, dpr: 1 },
  { width: 1920, height: 1080, dpr: 1 },
]
