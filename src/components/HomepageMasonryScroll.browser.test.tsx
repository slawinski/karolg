import { afterEach, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'
import { HomepageMasonry } from './HomepageMasonry'
import type { HomepageMediaPool, HomepageMasonrySlot } from '@/lib/homepage'
import '@/app/(frontend)/styles.css'
import { gsap } from 'gsap'

const pools: HomepageMediaPool[] = [{
  id: 'scroll', photoshootSlug: 'scroll', photoshootTitle: 'Scroll',
  media: [{ id: 1, kind: 'image', width: 2, height: 3,
    url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="2" height="3"/%3E' }],
}]
const slots: HomepageMasonrySlot[] = Array.from({ length: 15 }, (_, index) => ({
  id: `scroll-${index}`, poolId: 'scroll', initialMediaIndex: 0,
}))
const columns = () => [...document.querySelectorAll<HTMLElement>('.cursor-masonry__column')]
const y = (column: HTMLElement) => new DOMMatrix(getComputedStyle(column).transform).m42
const wheel = (deltaY: number, deltaMode = 0) => window.dispatchEvent(new WheelEvent('wheel', { deltaY, deltaMode, cancelable: true }))
async function fixture() {
  await page.viewport(1440, 900)
  window.scrollTo({ top: 0, behavior: 'instant' })
  return render(<div className="masonry-stage"><h1 className="masonry-name">Title</h1><HomepageMasonry pools={pools} slots={slots} /><div style={{ height: 2000 }} /></div>)
}
afterEach(async () => { await cleanup(); vi.unstubAllGlobals(); window.scrollTo({ top: 0, behavior: 'instant' }) })

it('retargets actual independent transforms then converges to one reversible raw-wheel offset', async () => {
  await fixture()
  wheel(120)
  await expect.poll(() => y(columns()[2])).toBeLessThan(-55)
  expect(y(columns()[1])).toBeGreaterThan(y(columns()[2]) + 1)
  await expect.poll(() => columns().every((column) => Math.abs(y(column) + 60) < 1)).toBe(true)
  wheel(-120, 1)
  await expect.poll(() => columns().every((column) => Math.abs(y(column)) < 1)).toBe(true)
  wheel(1e6, 2)
  const bound = Math.max(...columns().map((column) => column.clientHeight / 2))
  await expect.poll(() => columns().every((column) => Math.abs(y(column) + bound) < 1)).toBe(true)
  wheel(-1e6)
  await expect.poll(() => columns().every((column) => Math.abs(y(column)) < 1)).toBe(true)
})

it('retains settlement outside the viewport, ignores offscreen input, and retains offsets through topology changes', async () => {
  await fixture()
  wheel(120)
  window.scrollTo({ top: 4000, behavior: 'instant' })
  await expect.poll(() => columns().every((column) => Math.abs(y(column) + 60) < 1)).toBe(true)
  wheel(120)
  await new Promise(requestAnimationFrame)
  expect(y(columns()[0])).toBeCloseTo(-60, 0)
  window.scrollTo({ top: 0, behavior: 'instant' })
  await page.viewport(1000, 900)
  await expect.poll(() => columns().length).toBe(3)
  expect(y(columns()[0])).toBeCloseTo(-60, 0)
  wheel(-120)
  await expect.poll(() => columns().every((column) => Math.abs(y(column)) < 1)).toBe(true)
})

it('clears only owned offsets on live eligibility loss and restarts from zero', async () => {
  const preference = Object.assign(new EventTarget(), { matches: true })
  vi.stubGlobal('matchMedia', () => preference)
  const view = await fixture()
  wheel(120)
  await expect.poll(() => y(columns()[2])).toBeLessThan(-10)
  preference.matches = false
  preference.dispatchEvent(new Event('change'))
  expect(columns().every((column) => column.style.transform === '')).toBe(true)
  preference.matches = true
  preference.dispatchEvent(new Event('change'))
  expect(columns().every((column) => Math.abs(y(column)) < 1)).toBe(true)
  const removed = columns()
  await view.unmount()
  wheel(120)
  expect(removed.every((column) => column.style.transform === '')).toBe(true)
})

it('uses positional durations and rechecks a stationary pointer during vertical catch-up alone', async () => {
  await fixture()
  wheel(400)
  expect(columns().map((column) => gsap.getTweensOf(column)[0].duration())).toEqual([.5, .8, .2, .3, .6])
  columns().forEach((column) => gsap.getTweensOf(column)[0].progress(1))
  const viewport = document.querySelector<HTMLElement>('.cursor-masonry')!
  const rail = document.querySelector<HTMLElement>('.cursor-masonry__rail')!
  const x = 1000
  const yPointer = 300
  viewport.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: yPointer, bubbles: true }))
  const center = -(rail.scrollWidth - viewport.clientWidth) / 2
  await expect.poll(() => new DOMMatrix(getComputedStyle(rail).transform).m41).toBeLessThan(center - 30)
  // Move the skyline down past the stored pointer without any page scroll or pointer input.
  wheel(-400)
  await expect.poll(() => new DOMMatrix(getComputedStyle(rail).transform).m41, { timeout: 3000 }).toBeCloseTo(center, 0)
  await page.viewport(1000, 900)
  await expect.poll(() => columns().length).toBe(3)
  wheel(120)
  expect(columns().map((column) => gsap.getTweensOf(column)[0].duration())).toEqual([.5, .8, .2])
})

it('clips only the images at the page-relative title origin without shortening the document', async () => {
  await fixture()
  const viewport = document.querySelector<HTMLElement>('.cursor-masonry')!
  const title = document.querySelector<HTMLElement>('.masonry-name')!
  expect(viewport.contains(title)).toBe(false)
  expect(getComputedStyle(viewport).overflowY).toBe('hidden')
  expect(viewport.getBoundingClientRect().top).toBe(title.getBoundingClientRect().top)
  const height = viewport.clientHeight
  const documentHeight = document.documentElement.scrollHeight
  wheel(1e6)
  await expect.poll(() => y(columns()[0])).toBeLessThan(-100)
  expect(viewport.clientHeight).toBe(height)
  expect(document.documentElement.scrollHeight).toBe(documentHeight)
  const card = columns()[0].querySelector<HTMLElement>('.masonry-card')!
  const rect = card.getBoundingClientRect()
  const edge = viewport.getBoundingClientRect().top
  expect(rect.top).toBeLessThan(edge)
  expect(document.elementFromPoint(Math.max(1, rect.right - 5), edge - 1)?.closest('.masonry-card')).toBeFalsy()
  window.scrollTo({ top: 100, behavior: 'instant' })
  expect(viewport.getBoundingClientRect().top).toBe(edge - 100)
  wheel(-1e6)
  await expect.poll(() => Math.abs(y(columns()[0]))).toBeLessThan(1)
  expect(document.documentElement.scrollWidth).toBe(innerWidth)
})

it('uses 8–16px desktop gaps and matching image estimates across responsive widths', async () => {
  await fixture()
  for (const width of [701, 1000, 1440, 1920]) {
    await page.viewport(width, 900)
    await expect.poll(() => columns().length).toBe(width <= 1100 ? 3 : 5)
    const expected = Math.max(8, Math.min(16, width * .01))
    const rail = document.querySelector<HTMLElement>('.cursor-masonry__rail')!
    const inner = columns()[0].querySelector<HTMLElement>('.cursor-masonry__column-motion')!
    expect(parseFloat(getComputedStyle(rail).columnGap)).toBeCloseTo(expected, 1)
    expect(parseFloat(getComputedStyle(inner).rowGap)).toBeCloseTo(expected, 1)
    const count = columns().length
    expect(columns()[0].clientWidth).toBeCloseTo((rail.getBoundingClientRect().width - expected * (count - 1)) / count, 0)
    expect(document.querySelector('img')!.sizes).toContain('clamp(8px, 1vw, 16px)')
  }
  await page.viewport(390, 844)
  await expect.poll(() => columns().length).toBe(2)
  expect(getComputedStyle(document.querySelector('.cursor-masonry__rail')!).gap).toBe('8px')
})
