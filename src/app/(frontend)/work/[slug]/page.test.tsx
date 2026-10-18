import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import WorkPage from './page'
import { getPhotoshootMedia } from '@/lib/portfolio'
import { regressionMedia } from '@/test/fixtures/photoshoot-candidates'

vi.mock('next/server', () => ({ connection: async () => {} }))
const versionedRegressionMedia = regressionMedia.map((media) => ({ ...media, processingRevision: 1 }))

vi.mock('@/lib/portfolio', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/portfolio')>(),
  getPhotoshootBySlug: vi.fn().mockResolvedValue({ id: 1, title: 'Portraits' }),
  getSiteSettings: vi.fn().mockResolvedValue({}),
  getPhotoshootMedia: vi.fn().mockResolvedValue([
    { id: 1, kind: 'video', processingStatus: 'ready', playbackFilename: 'clip.mp4',
      playbackUrl: '/media/clip.mp4', posterFilename: 'poster.jpg', posterUrl: '/media/poster.jpg' },
    { id: 2, kind: 'image', url: '/media/first.jpg', processingRevision: 1, width: 1000, height: 1500 },
    { id: 3, kind: 'image', url: '/media/later.jpg', processingRevision: 1, width: 1000, height: 1500 },
  ]),
}))

describe('photoshoot image delivery', () => {
  it('selects visible stills after a video while deferring video playback', async () => {
    const markup = renderToStaticMarkup(await WorkPage({ params: Promise.resolve({ slug: 'portraits' }) }))
    const images = markup.match(/<img\b[^>]*>/g)!
    expect(images).toHaveLength(3)
    expect(images[0]).toContain('loading="eager"')
    expect(images[0]).toContain('fetchPriority="high"')
    expect(images[2]).toContain('loading="lazy"')
    expect(images[2]).not.toContain('fetchPriority="high"')
    expect(images[1]).toContain('(max-width: 700px) calc(50vw - 4px)')
    expect(markup.match(/<link\b[^>]*as="image"[^>]*>/g) || []).toHaveLength(1)
    const video = markup.match(/<video\b[^>]*>/)![0]
    expect(video).toContain('preload="none"')
    expect(video).not.toContain('controls=""')
    expect(video).toContain('muted=""')
    expect(video).toContain('playsInline=""')
    expect(video).not.toContain('poster=')
    expect(video).not.toContain('autoPlay')
    expect(video).not.toContain('src=')
  })

  it('delivers the retained later mobile LCP in initial SSR and bounds the entire hint/image union', async () => {
    vi.mocked(getPhotoshootMedia).mockResolvedValueOnce(versionedRegressionMedia)
    const markup = renderToStaticMarkup(await WorkPage({ params: Promise.resolve({ slug: 'a' }) }))
    const images = markup.match(/<img\b[^>]*>/g)!
    const hints = markup.match(/<link\b[^>]*as="image"[^>]*>/g) || []
    expect(images).toHaveLength(9)
    expect(images[5]).toContain('loading="eager"')
    expect(images[5]).toContain('fetchPriority="high"')
    const urgent = images.filter((image) => image.includes('loading="eager"'))
    expect(urgent.length).toBeLessThanOrEqual(4)
    expect(urgent.length).toBeGreaterThan(1)
    expect(hints).toHaveLength(urgent.length)
    const identity = (tag: string) => decodeURIComponent(tag.match(/url=([^&]+)/)![1])
    expect(new Set([...urgent, ...hints].map(identity)).size).toBeLessThanOrEqual(4)
    hints.forEach((hint) => {
      expect(urgent.map(identity)).toContain(identity(hint))
      expect(hint).toContain('imageSrcSet=')
      expect(hint).toContain('imageSizes=')
    })
    images.forEach((image) => {
      expect(image).toContain('(max-width: 700px) calc(50vw - 4px)')
      if (!urgent.includes(image)) {
        expect(image).toContain('loading="lazy"')
        expect(image).not.toContain('fetchPriority="high"')
      }
    })
    vi.mocked(getPhotoshootMedia).mockResolvedValueOnce(versionedRegressionMedia)
    expect(renderToStaticMarkup(await WorkPage({ params: Promise.resolve({ slug: 'a' }) }))).toBe(markup)
  })
})
