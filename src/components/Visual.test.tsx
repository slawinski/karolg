import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Visual } from './Visual'

describe('Visual', () => {
  it('renders ready video as semantic manual playback with a poster', () => {
    const markup = renderToStaticMarkup(
      <Visual
        media={{
          kind: 'video',
          processingStatus: 'ready',
          playbackFilename: 'generated/1/r1/playback.mp4',
          playbackUrl: '/media/clip.mp4',
          posterFilename: 'generated/1/r1/poster.jpg',
          posterUrl: '/media/clip.jpg',
          alt: 'Model walking',
        }}
        alt="Fallback"
        sizes="100vw"
      />,
    )

    expect(markup).toContain('<video')
    expect(markup).toContain('controls=""')
    expect(markup).toContain('playsInline=""')
    expect(markup).toContain('preload="metadata"')
    expect(markup).toContain('poster="/media/clip.jpg"')
    expect(markup).not.toContain('<img')
  })

  it('uses the accessible fallback for unusable video', () => {
    const markup = renderToStaticMarkup(
      <Visual
        media={{ kind: 'video', processingStatus: 'failed' }}
        alt="Unavailable portfolio video"
        sizes="100vw"
      />,
    )

    expect(markup).toContain('role="img"')
    expect(markup).toContain('aria-label="Unavailable portfolio video"')
  })
})
