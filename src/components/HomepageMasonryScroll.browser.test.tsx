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
