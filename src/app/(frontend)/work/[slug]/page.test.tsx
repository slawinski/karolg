import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import WorkPage from './page'

vi.mock('@/lib/portfolio', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/portfolio')>(),
  getPhotoshootBySlug: vi.fn().mockResolvedValue({ id: 1, title: 'Portraits' }),
  getPortfolioData: vi.fn().mockResolvedValue({ site: {} }),
  getPhotoshootMedia: vi.fn().mockResolvedValue([
    { id: 1, kind: 'video', processingStatus: 'ready', playbackFilename: 'clip.mp4',
      playbackUrl: '/media/clip.mp4', posterFilename: 'poster.jpg', posterUrl: '/media/poster.jpg' },
    { id: 2, kind: 'image', url: '/media/first.jpg', width: 1000, height: 1500 },
    { id: 3, kind: 'image', url: '/media/later.jpg', width: 1000, height: 1500 },
  ]),
}))

describe('photoshoot image delivery', () => {
  it('makes the first still image eager and urgent even after a video, leaving later images lazy', async () => {
    const markup = renderToStaticMarkup(await WorkPage({ params: Promise.resolve({ slug: 'portraits' }) }))
    const images = markup.match(/<img\b[^>]*>/g)!
    expect(images).toHaveLength(2)
    expect(images[0]).toContain('loading="eager"')
    expect(images[0]).toContain('fetchPriority="high"')
    expect(images[1]).toContain('loading="lazy"')
    expect(images[1]).not.toContain('fetchPriority="high"')
    expect(images[0]).toContain('(max-width: 700px) calc(50vw - 4px)')
    expect(markup.match(/rel="preload"/g) || []).toHaveLength(1)
  })
})
