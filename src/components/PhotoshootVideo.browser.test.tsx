import { act } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render } from 'vitest-browser-react'
import type { MediaLike } from '@/lib/media'
import { PhotoshootVideo } from './PhotoshootVideo'
import { PublicMediaReadiness } from './PublicMediaReadiness'
import '@/app/(frontend)/styles.css'

const clip: MediaLike = { id: 9, kind: 'video', processingRevision: 1,
  playbackFilename: 'generated/9/r1/playback.mp4', playbackUrl: '/__controlled__/clip.mp4',
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
  expect(video.getAttribute('src')).toBe('/__controlled__/clip.mp4?v=1')
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
