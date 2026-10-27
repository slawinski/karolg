import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'
import { act } from 'react'
import { HomepageMasonry } from './HomepageMasonry'
import type { HomepageMediaPool, HomepageMasonrySlot } from '@/lib/homepage'
import '@/app/(frontend)/styles.css'

const pools: HomepageMediaPool[] = [{
  id: 'pointer', photoshootSlug: 'pointer', photoshootTitle: 'Pointer',
  media: [{ id: 1, kind: 'image', width: 2, height: 3,
    url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="2" height="3"/%3E' }],
}]
const slots: HomepageMasonrySlot[] = Array.from({ length: 10 }, (_, index) => ({
  id: `pointer-${index}`, poolId: 'pointer', initialMediaIndex: 0,
}))
let frames: Map<number, FrameRequestCallback>
let nextFrame: number
let frameTime: number
let finePointer = true
let reducedMotion = false
const viewport = () => document.querySelector<HTMLElement>('.cursor-masonry')!
const rail = () => document.querySelector<HTMLElement>('.cursor-masonry__rail')!
const cards = () => Array.from(document.querySelectorAll<HTMLElement>('[data-first-row]'))
const offset = () => new DOMMatrix(getComputedStyle(rail()).transform).m41
const center = () => -(rail().scrollWidth - viewport().clientWidth) / 2
const move = (x: number, y: number) => viewport().dispatchEvent(new PointerEvent('pointermove', {
  clientX: x, clientY: y, bubbles: true, pointerType: 'mouse',
}))
const step = (elapsed = 1000 / 60) => {
  frameTime += elapsed
  const pending = [...frames.values()]
  frames.clear()
  pending.forEach((callback) => callback(frameTime))
}
const settle = () => { for (let i = 0; i < 240 && frames.size; i++) step() }
const belowSkyline = () => Math.max(...cards().map((card) => card.getBoundingClientRect().top)) + 40

beforeEach(async () => {
  await page.viewport(1440, 1000)
  window.scrollTo({ top: 0, behavior: 'instant' })
  frames = new Map()
  nextFrame = 0
  frameTime = performance.now()
  finePointer = true
  reducedMotion = false
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} })
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : finePointer,
    addEventListener() {}, removeEventListener() {},
  }))
})

afterEach(async () => {
  await cleanup()
  vi.unstubAllGlobals()
  window.scrollTo({ top: 0, behavior: 'instant' })
})

it('recenters in short-column headroom and resumes below the skyline', async () => {
  await render(<HomepageMasonry pools={pools} slots={slots} />)
  const x = viewport().getBoundingClientRect().width * 0.72
  move(x, belowSkyline())
  settle()
  expect(offset()).toBeLessThan(center() - 30)
  const short = cards()[3].getBoundingClientRect()
  move((short.left + short.right) / 2, short.top - 20)
  settle()
  expect(offset()).toBeCloseTo(center(), 1)
  move(x, belowSkyline())
  settle()
  expect(offset()).toBeLessThan(center() - 30)
})

it('keeps keyboard-focused edge cards inside the viewport instead of the clipped pointer rail', async () => {
  await render(<HomepageMasonry pools={pools} slots={slots} />)
  for (const card of [cards()[0], cards().at(-1)!]) {
    const link = card.querySelector<HTMLAnchorElement>('a')!
    link.focus()
    move(1000, belowSkyline())
    settle()
    const box = link.getBoundingClientRect()
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.right).toBeLessThanOrEqual(innerWidth)
    expect(document.activeElement).toBe(link)
  }
})

it('bridges gutters at the lower top and keeps vertical gaps active', async () => {
  await render(<HomepageMasonry pools={pools} slots={slots} />)
  const high = cards()[0].getBoundingClientRect()
  const low = cards()[1].getBoundingClientRect()
  const gutterX = (high.right + low.left) / 2
  move(gutterX, (high.top + low.top) / 2)
  settle()
  expect(offset()).toBeCloseTo(center(), 1)
  move(gutterX, low.top + 20)
  step()
  expect(offset()).toBeGreaterThan(center() + 5)
  settle()
  const columnCards = document.querySelectorAll('.cursor-masonry__column:first-child .masonry-card')
  const first = columnCards[0].getBoundingClientRect()
  const second = columnCards[1].getBoundingClientRect()
  const x = first.right - 15
  move(x, (first.bottom + second.top) / 2)
  settle()
  expect(offset()).toBeCloseTo(-(rail().scrollWidth - viewport().clientWidth) * x / viewport().clientWidth, 1)
})

it.each([30, 120])('returns to center within three seconds at %i frames per second', async (fps) => {
  await render(<HomepageMasonry pools={pools} slots={slots} />)
  move(1000, belowSkyline())
  for (let i = 0; i < fps; i++) step(1000 / fps)
  expect(offset()).toBeLessThan(center() - 30)
  viewport().dispatchEvent(new PointerEvent('pointerleave'))
  for (let i = 0; i < fps * 3; i++) step(1000 / fps)
  expect(offset()).toBeCloseTo(center(), 0)
})

it('detects a skyline crossing under a stationary pointer and latches the return', async () => {
  await render(<HomepageMasonry pools={pools} slots={slots} />)
  const first = cards()[2].getBoundingClientRect()
  const second = cards()[3].getBoundingClientRect()
  const x = first.right - 8
  const y = (first.top + second.top) / 2
  expect(x).toBeGreaterThan(0)
  move(x, y)
  let crossed = false
  let furthest = offset()
  let reversed = false
  for (let i = 0; i < 240 && frames.size; i++) {
    step()
    const a = cards()[2].getBoundingClientRect()
    const b = cards()[3].getBoundingClientRect()
    if (x > a.right && x < b.right && y < b.top) crossed = true
    if (crossed && offset() > furthest + 0.1) reversed = true
    furthest = Math.min(furthest, offset())
  }
  expect(crossed).toBe(true)
  expect(reversed).toBe(true)
  expect(offset()).toBeCloseTo(center(), 1)
})

it('rechecks the latest headroom position on scroll and forgets a departed cursor', async () => {
  await render(<div style={{ paddingTop: 300, paddingBottom: 1000 }}>
    <HomepageMasonry pools={pools} slots={slots} />
  </div>)
  move(1000, belowSkyline())
  settle()
  const short = cards()[3].getBoundingClientRect()
  const x = (short.left + short.right) / 2
  const y = short.top - 20
  move(x, y)
  settle()
  expect(offset()).toBeCloseTo(center(), 1)
  window.dispatchEvent(new Event('scroll'))
  settle()
  expect(offset()).toBeCloseTo(center(), 1)
  window.scrollTo({ top: 250, behavior: 'instant' })
  window.dispatchEvent(new Event('scroll'))
  settle()
  expect(Math.abs(offset() - center())).toBeGreaterThan(20)
  viewport().dispatchEvent(new PointerEvent('pointerleave'))
  settle()
  window.dispatchEvent(new Event('scroll'))
  window.dispatchEvent(new Event('resize'))
  settle()
  expect(offset()).toBeCloseTo(center(), 1)
})

it('uses the actual three-column skyline after a responsive resize', async () => {
  await render(<HomepageMasonry pools={pools} slots={slots} />)
  await act(async () => { await page.viewport(1000, 1000) })
  await vi.waitFor(() => expect(cards()).toHaveLength(3))
  const short = cards()[1].getBoundingClientRect()
  move(short.right - 30, short.top - 10)
  settle()
  expect(offset()).toBeCloseTo(center(), 1)
  move(800, belowSkyline())
  settle()
  expect(offset()).toBeLessThan(center() - 30)
})

it.each(['reduced motion', 'coarse pointer'])('preserves the %s motion restriction', async (mode) => {
  reducedMotion = mode === 'reduced motion'
  finePointer = mode !== 'coarse pointer'
  await render(<HomepageMasonry pools={pools} slots={slots} />)
  move(1000, belowSkyline())
  settle()
  expect(rail().style.transform).toBe('')
})
