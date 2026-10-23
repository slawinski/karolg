import { afterEach, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'
import { PortfolioHeader } from './PortfolioHeader'
import { PhotoshootGallery } from './PhotoshootGallery'
import { candidateViewports, controlledMedia, controlledVideo, regressionMedia, regressionPhotoshoot } from '@/test/fixtures/photoshoot-candidates'
import type { MediaLike } from '@/lib/media'
import { photoshootPresentationImage, selectPhotoshootCandidates } from '@/lib/photoshoot-candidates'
import '@/app/(frontend)/styles.css'

afterEach(cleanup)

async function gallery(media: MediaLike[], title = regressionPhotoshoot.title) {
  await render(<main className="photoshoot-page">
    <PortfolioHeader instagram="https://example.com" />
    <section className="photoshoot-head"><h1>{title}</h1></section>
    <PhotoshootGallery media={media} title={title}>
      {media.map((item, index) => <figure key={index}
        className={`photoshoot-gallery-item photoshoot-gallery-item-${index % 7 + 1} image-frame`}>
        {item.kind === 'video'
          ? <><video className="visual-img visual-video" muted playsInline preload="none" /><img className="media-poster photoshoot-video-poster" alt="" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" style={{ position: 'absolute', width: '100%', height: '100%', inset: 0 }} /></>
          : <img className="visual-img" alt={`Slot ${index}`} src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" style={{ position: 'absolute', width: '100%', height: '100%', inset: 0 }} />}
        <button className="photoshoot-gallery-trigger" data-media-index={index} aria-label={`Open slot ${index}`} />
      </figure>)}
    </PhotoshootGallery>
  </main>)
  return Array.from(document.querySelectorAll('figure')).map((node) => node.getBoundingClientRect())
}

it('retains the actual nine-slot regression and characterizes balanced columns before selection', async () => {
  await page.viewport(390, 844)
  const rects = await gallery(regressionMedia)
  expect(document.querySelector('h1')?.textContent).toBe('A')
  expect(rects).toHaveLength(9)
  expect(regressionMedia[5].filename).toBe('IMG_3912.JPG')
  expect(rects[5].x).toBe(199)
  // The supplied older Chromium observation was 377.039; Chromium 156 uses
  // a 3px rather than 4px inline baseline contribution (376.031 here).
  expect(Math.abs(rects[5].y - 377.039)).toBeLessThan(2)
  expect(rects[5].width).toBe(191)
  expect(rects[5].height).toBeCloseTo(318.328, 1)
  expect(rects[5].height).toBeGreaterThan(rects[0].height)
  expect(rects.map((rect) => rect.x)).toEqual([0, 0, 0, 0, 199, 199, 199, 199, 199])
  const inlineContribution = rects[1].y - rects[0].bottom - 8
  expect(inlineContribution).toBeGreaterThanOrEqual(3)
  expect(inlineContribution).toBeLessThanOrEqual(5)
})

it('characterizes lengths, breakpoints, title clipping and full-slot video geometry', async () => {
  const ratios = [3 / 4, 4 / 5, 1, 2 / 3, 5 / 4, 3 / 5, 4 / 3]
  for (const width of [...candidateViewports.map((item) => item.width), 700, 701, 1100, 1101]) {
    await page.viewport(width, 900)
    for (const count of [0, 1, 2, 6, 7, 14]) {
      const media = controlledMedia(count)
      if (count > 2) { media[0] = controlledVideo; media[3] = { ...controlledVideo, id: 'boundary-video' } }
      for (const title of ['A', 'Editorial Portraits', 'Editorial Portraits in Natural Light', Array(60).fill('Portraits').join(' ')]) {
        const rects = await gallery(media, title)
        const container = document.querySelector('.photoshoot-gallery')!
        const style = getComputedStyle(container)
        expect(style.columnCount).toBe(width <= 1100 ? '2' : '3')
        expect(parseFloat(style.columnGap)).toBeCloseTo(width <= 700 ? 8 : Math.min(24, Math.max(12, width * .015)), 1)
        expect(parseFloat(style.paddingLeft)).toBeCloseTo(width <= 700 ? 0 : Math.min(46, Math.max(18, width * .028)), 1)
        rects.forEach((rect, index) => expect(rect.width / rect.height).toBeCloseTo(ratios[index % 7], 3))
        const videos = Array.from(document.querySelectorAll('video'))
        videos.forEach((video) => {
          expect(video.controls).toBe(false)
          expect(video.playsInline).toBe(true)
          expect(video.preload).toBe('none')
          expect(video.autoplay).toBe(false)
          expect(video.hasAttribute('src')).toBe(false)
        })
        if (title.length > 100 && count) expect(rects[0].top).toBeGreaterThan(900)
        await cleanup()
      }
    }
  }
}, 60000)

it('covers actual largest clipped stills with the same bounded responsive identity set', async () => {
  const galleries = [1, 2, 6, 7, 14].map(controlledMedia)
  galleries.push(regressionMedia)
  const mixed = controlledMedia(14)
  mixed[0] = controlledVideo
  mixed[5] = { ...controlledVideo, id: 'interleaved-video' }
  galleries.push(mixed)
  for (const media of galleries) {
    const selected = selectPhotoshootCandidates(media)
    expect(selected.size).toBeLessThanOrEqual(4)
    for (const { width, height } of candidateViewports) {
      await page.viewport(width, height)
      for (const title of ['A', 'Editorial Portraits', 'Editorial Portraits in Natural Light', Array(60).fill('Portraits').join(' ')]) {
        const rects = await gallery(media, title)
        const areas = rects.map((rect) => rect.width * Math.max(0, Math.min(rect.bottom, height) - Math.max(0, rect.top)))
        const max = Math.max(0, ...areas)
        const winners = areas.flatMap((area, index) => area > 0 && Math.abs(area - max) < 1 ? [index] : [])
        expect(winners.length === 0 || winners.some((index) => selected.has(photoshootPresentationImage(media[index])!)),
          JSON.stringify({ width, height, title, count: media.length, winners, selected: [...selected], areas, rects })).toBe(true)
        await cleanup()
      }
    }
  }
}, 60000)
