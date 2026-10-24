import { act } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render } from 'vitest-browser-react'
import type { MediaLike } from '@/lib/media'
import { PhotoshootVideo } from './PhotoshootVideo'
import { PublicMediaReadiness } from './PublicMediaReadiness'
import '@/app/(frontend)/styles.css'

const clipUrl = new URL('../test/fixtures/clip.mp4', import.meta.url).href
const clip: MediaLike = { id: 9, kind: 'video', processingRevision: 1,
  playbackFilename: 'generated/9/r1/playback.mp4', playbackUrl: clipUrl,
  posterFilename: 'generated/9/r1/poster.jpg',
  posterUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' }
let intersect: IntersectionObserverCallback
let visible = true
let reduced = false
let motionListeners: Set<() => void>
const emit = async (ratio: number) => act(async () => intersect([{
  target: document.querySelector('video')!, isIntersecting: ratio > 0, intersectionRatio: ratio,
  boundingClientRect: new DOMRect(), intersectionRect: new DOMRect(), rootBounds: null, time: performance.now(),
}], {} as IntersectionObserver))
const visibility = async (value: boolean) => act(async () => {
  visible = value; document.dispatchEvent(new Event('visibilitychange'))
})
const renderClip = (media = clip) => render(<PhotoshootVideo alt="Studio tour" className="visual-img" media={media} eager sizes="50vw" />)
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  visible = true; reduced = false; motionListeners = new Set()
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visible ? 'visible' : 'hidden' })
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced },
    addEventListener: (_: string, fn: () => void) => motionListeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => motionListeners.delete(fn) }))
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback }
    observe() {} disconnect() {}
  })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
})
afterEach(async () => { await cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('shows the eager responsive poster before silent inline control-free autoplay', async () => {
  await renderClip()
  const video = document.querySelector('video')!
  const poster = document.querySelector('img')!
  expect(video.controls).toBe(false)
  expect(video.muted && video.playsInline).toBe(true)
  expect(video.hasAttribute('poster')).toBe(false)
  expect(video.hasAttribute('src')).toBe(false)
  expect(poster.loading).toBe('eager')
  expect(poster.sizes).toBe('50vw')
  expect(poster.style.opacity).toBe('1')
  await emit(1)
  expect(video.getAttribute('src')).toBe(`${clipUrl}?v=1`)
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
  expect(poster.style.opacity).toBe('0')
  await emit(0)
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
  expect(poster.style.opacity).toBe('1')
})

it('does not acquire while hidden or reduced, then starts when eligible', async () => {
  visible = false
  await renderClip()
  await emit(1)
  expect(document.querySelector('video')!.hasAttribute('src')).toBe(false)
  reduced = true
  await visibility(true)
  expect(document.querySelector('video')!.hasAttribute('src')).toBe(false)
  reduced = false
  await act(async () => motionListeners.forEach((fn) => fn()))
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
})

it('keeps the poster after policy rejection without retries or controls', async () => {
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
  await renderClip(); await emit(1)
  await visibility(false); await visibility(true)
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
  expect(document.querySelector('img')!.style.opacity).toBe('1')
  expect(document.querySelector('video')!.controls).toBe(false)
})

it('retains the poster on media failure and does not latch expected play cancellation', async () => {
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException('paused', 'AbortError'))
  await renderClip(); await emit(1)
  await expect.poll(() => document.querySelector('video')!.readyState).toBeGreaterThanOrEqual(1)
  await visibility(false); await visibility(true)
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2)
  await act(async () => document.querySelector('video')!.dispatchEvent(new Event('error')))
  expect(document.querySelector('img')!.style.opacity).toBe('1')
  await visibility(false); await visibility(true)
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2)
})

it('ignores expected cancellation, stops a late hidden start, and resumes later', async () => {
  let resolve!: () => void
  vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(() => new Promise<void>((done) => { resolve = done }))
  await renderClip(); await emit(1)
  await visibility(false)
  await act(async () => resolve())
  expect(document.querySelector('img')!.style.opacity).toBe('1')
  await visibility(true)
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2)
  expect(document.querySelector('img')!.style.opacity).toBe('0')
})

it('releases revision resources and resets failed autoplay for the new source', async () => {
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))
  const view = await renderClip(); await emit(1)
  await view.rerender(<PhotoshootVideo alt="New" className="visual-img" media={{ ...clip,
    playbackFilename: 'generated/9/r2/playback.mp4', posterFilename: 'generated/9/r2/poster.jpg' }} />)
  expect(HTMLMediaElement.prototype.load).toHaveBeenCalled()
  expect(document.querySelector('video')!.src).toContain('v=2')
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2)
})

it.each(['visibility', 'replacement'] as const)('keeps newer playback when an obsolete %s play resolves last', async (change) => {
  const pending: (() => void)[] = []
  vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(() => new Promise<void>((resolve) => pending.push(resolve)))
  const view = await renderClip(); await emit(1)
  const video = document.querySelector('video')!
  if (change === 'visibility') {
    await visibility(false); await visibility(true)
  } else {
    await view.rerender(<PhotoshootVideo alt="New" className="visual-img" media={{ ...clip,
      playbackFilename: 'generated/9/r2/playback.mp4', posterFilename: 'generated/9/r2/poster.jpg' }} />)
    expect(video.src).toContain('v=2')
  }
  expect(pending).toHaveLength(2)
  await act(async () => pending[1]())
  expect(document.querySelector('img')!.style.opacity).toBe('0')
  const pauses = vi.mocked(HTMLMediaElement.prototype.pause).mock.calls.length
  await act(async () => pending[0]())
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(pauses)
  expect(document.querySelector('img')!.style.opacity).toBe('0')
  expect(getComputedStyle(video).opacity).toBe('1')
})

it('counts only foreground time when readiness resumes after a partial delay', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] })
  let now = 100
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue()
  try {
    await render(<PublicMediaReadiness routeKey="foreground"><img data-public-critical />
      <PhotoshootVideo alt="Clip" className="visual-img" media={clip} /></PublicMediaReadiness>)
    await emit(1)
    now += 500
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    await visibility(false)
    now += 5000
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(document.querySelector('video')!.hasAttribute('src')).toBe(false)
    await visibility(true)
    now += 999
    await act(async () => { await vi.advanceTimersByTimeAsync(999) })
    expect(document.querySelector('[data-public-media-ready]')!.getAttribute('data-public-media-ready')).toBe('false')
    expect(document.querySelector('video')!.hasAttribute('src')).toBe(false)
    now += 1
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    // Readiness publishes after two animation frames, then acquisition/playback can start.
    await act(async () => { await vi.advanceTimersByTimeAsync(50) })
    expect(document.querySelector('video')!.hasAttribute('src')).toBe(true)
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
  } finally {
    vi.useRealTimers()
  }
})

it('does not attach playback behind a pending critical image or minimum readiness delay', async () => {
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false)
  await render(<PublicMediaReadiness routeKey="fixture"><img data-public-critical />
    <PhotoshootVideo alt="Clip" className="visual-img" media={clip} /></PublicMediaReadiness>)
  await emit(1)
  await new Promise((done) => setTimeout(done, 1600))
  expect(document.querySelector('video')!.hasAttribute('src')).toBe(false)
  await act(async () => document.querySelector('img')!.dispatchEvent(new Event('load')))
  await expect.poll(() => document.querySelector('video')!.hasAttribute('src')).toBe(true)
})
