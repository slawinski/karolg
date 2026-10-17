import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Visual } from './Visual'

describe('Visual', () => {
  it('optimizes revision-bearing images and bypasses legacy mutable images', () => {
    const render = (processingRevision?: number) => renderToStaticMarkup(<Visual media={{ url: '/api/media/file/portrait.jpg', processingRevision }} alt="Portrait" sizes="100vw" />)
    expect(render(2)).toContain('%2Fapi%2Fmedia%2Ffile%2Fportrait.jpg%3Fv%3D2')
    expect(render(3)).toContain('%2Fapi%2Fmedia%2Ffile%2Fportrait.jpg%3Fv%3D3')
    for (const revision of [undefined, 0, -1, 1.5]) {
      expect(render(revision)).toContain('src="/api/media/file/portrait.jpg"')
      expect(render(revision)).not.toContain('/_next/image')
    }
  })
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
