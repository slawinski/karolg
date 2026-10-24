import { act, StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'
import { PhotoshootGallery } from './PhotoshootGallery'
import { PublicMediaReadiness } from './PublicMediaReadiness'
import type { MediaLike } from '@/lib/media'
import '@/app/(frontend)/styles.css'

const pixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const photos: MediaLike[] = Array.from({ length: 9 }, (_, i) => ({ id: i, url: pixel, alt: `Portrait ${i + 1}` }))
afterEach(async () => { await cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

async function gallery(media = photos) {
  return render(<PhotoshootGallery media={media} title="Story">
    {media.map((item, i) => <figure key={i} className={`photoshoot-gallery-item photoshoot-gallery-item-${i % 7 + 1} image-frame`}>
      <img src={pixel} alt="Gallery" />
      <button className="photoshoot-gallery-trigger" data-media-index={i} aria-label={`Open item ${i + 1}`} />
    </figure>)}
  </PhotoshootGallery>)
}
const dialog = () => document.querySelector('dialog')!
const close = () => document.querySelector<HTMLButtonElement>('.photoshoot-viewer-close')!
const trigger = (i = 0) => document.querySelectorAll<HTMLButtonElement>('[data-media-index]')[i]

it('opens the selected photo modally without remounting figures and restores focus on close', async () => {
  await gallery()
  const figures = [...document.querySelectorAll('figure')]
  await act(async () => trigger(5).click())
  expect(dialog().matches(':modal')).toBe(true)
  expect(dialog().querySelector('img')?.alt).toBe('Portrait 6')
  expect(document.activeElement).toBe(close())
  expect([...document.querySelectorAll('figure')]).toEqual(figures)
  await act(async () => close().click())
  expect(document.querySelector('dialog')).toBeNull()
  expect(document.activeElement).toBe(trigger(5))
})

it('restores scroll and owned styles for close and Escape, and cleans up on route unmount', async () => {
  document.body.style.paddingBottom = '3000px'
  const view = await gallery()
  const original = document.body.style.position
  for (const key of ['button', 'Escape']) {
    window.scrollTo({ top: 350, behavior: 'instant' })
    await act(async () => trigger(5).click())
    expect(document.body.style.position).toBe('fixed')
    if (key === 'Escape') await userEvent.keyboard('{Escape}')
    else await act(async () => close().click())
    await expect.poll(() => document.querySelector('dialog')).toBeNull()
    expect(window.scrollY).toBe(350)
    expect(document.activeElement).toBe(trigger(5))
    expect(document.body.style.position).toBe(original)
  }
  await act(async () => trigger().click())
  await view.unmount()
  expect(document.body.style.position).toBe(original)
  document.body.style.paddingBottom = ''
})

it('contains photos and a reachable close target at phone, laptop and landscape sizes', async () => {
  for (const [width, height] of [[390, 844], [1366, 768], [844, 390]]) {
    await page.viewport(width, height)
    await gallery()
    await act(async () => trigger().click())
    const image = dialog().querySelector('img')!
    const rect = image.getBoundingClientRect()
    expect(getComputedStyle(image).objectFit).toBe('contain')
    expect(rect.top).toBeGreaterThanOrEqual(close().getBoundingClientRect().bottom)
    expect(rect.bottom).toBeLessThanOrEqual(height)
    expect(rect.width).toBeLessThanOrEqual(width)
    expect(close().getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    await cleanup()
  }
})

it('supports keyboard activation and empty and single-item galleries', async () => {
  await gallery([])
  expect(document.querySelector('dialog')).toBeNull()
  await cleanup()
  await gallery(photos.slice(0, 1))
  for (const key of ['Enter', 'Space']) {
    trigger().focus()
    await userEvent.keyboard(key === 'Enter' ? '{Enter}' : ' ')
    expect(dialog().open).toBe(true)
    await act(async () => close().click())
  }
})

const key = async (target: Element, value: string, options: KeyboardEventInit = {}) => act(async () => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options }))
})
async function swipe(target: Element, dx: number, dy = 0, kind = 'touchend', multiple = false) {
  const touch = (x: number, y: number) => ({ identifier: 1, target, clientX: x, clientY: y })
  await act(async () => {
    target.dispatchEvent(Object.assign(new Event('touchstart', { bubbles: true }), {
      touches: multiple ? [touch(150, 150), touch(160, 150)] : [touch(150, 150)],
    }))
    target.dispatchEvent(Object.assign(new Event(kind, { bubbles: true }), {
      touches: [], changedTouches: [touch(150 + dx, 150 + dy)],
    }))
  })
}
const activeAlt = () => dialog().querySelector('img')?.alt

it('navigates in array order with bounded arrows and returns to the original opener', async () => {
  await gallery(photos.slice(0, 3))
  await act(async () => trigger(1).click())
  await key(close(), 'ArrowRight')
  expect(activeAlt()).toBe('Portrait 3')
  await key(close(), 'ArrowRight')
  expect(activeAlt()).toBe('Portrait 3')
  await key(close(), 'ArrowLeft', { ctrlKey: true })
  expect(activeAlt()).toBe('Portrait 3')
  await key(close(), 'ArrowLeft')
  await key(close(), 'ArrowLeft')
  await key(close(), 'ArrowLeft')
  expect(activeAlt()).toBe('Portrait 1')
  expect(dialog().querySelectorAll('button')).toHaveLength(1)
  await act(async () => close().click())
  expect(document.activeElement).toBe(trigger(1))
})

it('accepts only horizontal single-touch swipes, once per release', async () => {
  await gallery(photos.slice(0, 3))
  await act(async () => trigger().click())
  const stage = document.querySelector('.photoshoot-viewer-stage')!
  for (const [dx, dy, kind, multi] of [[-20, 0, 'touchend', false], [-70, 80, 'touchend', false], [-70, 0, 'touchcancel', false], [-70, 0, 'touchend', true]] as const) {
    await swipe(stage, dx, dy, kind, multi)
    expect(activeAlt()).toBe('Portrait 1')
  }
  await swipe(stage, -70)
  expect(activeAlt()).toBe('Portrait 2')
  await swipe(stage, 70)
  expect(activeAlt()).toBe('Portrait 1')
})

it('ignores editable, video and already-handled keyboard events', async () => {
  await gallery()
  await act(async () => trigger().click())
  for (const tag of ['input', 'video']) {
    const target = document.createElement(tag)
    dialog().append(target)
    await key(target, 'ArrowRight')
    expect(activeAlt()).toBe('Portrait 1')
    target.remove()
  }
  const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
  event.preventDefault()
  await act(async () => close().dispatchEvent(event))
  expect(activeAlt()).toBe('Portrait 1')
})

const clipUrl = new URL('../test/fixtures/clip.mp4', import.meta.url).href
const clip: MediaLike = { id: 9, kind: 'video', alt: 'Studio film', processingRevision: 1,
  playbackFilename: 'generated/9/r1/playback.mp4', playbackUrl: clipUrl,
  posterFilename: 'generated/9/r1/poster.jpg', posterUrl: pixel }
function playback() {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  return vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
}

it('enters unmuted inline videos in array order with native controls and video input priority', async () => {
  const play = playback()
  await gallery([photos[0], clip, photos[2]])
  await act(async () => trigger().click())
  await key(close(), 'ArrowRight')
  const video = dialog().querySelector('video')!
  expect(video).not.toBeNull()
  expect(video.controls && video.playsInline).toBe(true)
  expect(video.muted || video.loop).toBe(false)
  expect(video.getAttribute('src')).toBe(`${clipUrl}?v=1`)
  expect(video.poster).toContain(pixel)
  expect(play).toHaveBeenCalledTimes(1)
  await key(video, 'ArrowRight')
  await swipe(video, -70)
  expect(dialog().querySelector('video')).toBe(video)
  const stage = document.querySelector('.photoshoot-viewer-stage')!
  expect(video.getBoundingClientRect().bottom).toBeLessThanOrEqual(stage.getBoundingClientRect().bottom - 44)
  await swipe(stage, -70)
  expect(activeAlt()).toBe('Portrait 3')
  expect(video.hasAttribute('src')).toBe(false)
})

it('retains an operable native play fallback after policy rejection', async () => {
  const play = playback().mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))
  await gallery([clip])
  await act(async () => trigger().click())
  const video = dialog().querySelector('video')!
  expect(video.controls).toBe(true)
  expect(dialog().textContent).not.toContain('unavailable')
  await video.play()
  expect(play).toHaveBeenCalledTimes(2)
})

it.each(['navigate', 'button', 'Escape', 'native-close', 'unmount'])('releases pending playback on %s and stops a late start', async (exit) => {
  let resolve!: () => void
  playback().mockImplementation(() => new Promise<void>((done) => { resolve = done }))
  const view = await gallery([clip, photos[0]])
  await act(async () => trigger().click())
  const video = dialog().querySelector('video')!
  if (exit === 'navigate') await key(close(), 'ArrowRight')
  else if (exit === 'button') await act(async () => close().click())
  else if (exit === 'Escape') await userEvent.keyboard('{Escape}')
  else if (exit === 'native-close') await act(async () => dialog().close())
  else await view.unmount()
  await expect.poll(() => video.hasAttribute('src')).toBe(false)
  const pauses = vi.mocked(video.pause).mock.calls.length
  await act(async () => resolve())
  expect(video.pause).toHaveBeenCalledTimes(pauses + 1)
  expect(video.hasAttribute('src')).toBe(false)
})

it('owns out-of-order video completions without pausing a newer player', async () => {
  const pending: (() => void)[] = []
  playback().mockImplementation(() => new Promise<void>((done) => pending.push(done)))
  await gallery([clip, { ...clip, id: 'second', alt: 'Second film' }, photos[0]])
  await act(async () => trigger().click())
  const first = dialog().querySelector('video')!
  await key(close(), 'ArrowRight')
  const second = dialog().querySelector('video')!
  expect(second).not.toBe(first)
  await act(async () => pending[0]())
  expect(dialog().querySelector('video')).toBe(second)
  expect(second.hasAttribute('src')).toBe(true)
  await key(close(), 'ArrowRight')
  await act(async () => pending[1]())
  expect(second.hasAttribute('src')).toBe(false)
  expect(activeAlt()).toBe('Portrait 1')
})

it('shows media failure without disabling navigation and resets failure on reentry', async () => {
  playback()
  await gallery([clip, photos[0]])
  await act(async () => trigger().click())
  await act(async () => dialog().querySelector('video')!.dispatchEvent(new Event('error')))
  expect(dialog().textContent).toContain('unavailable')
  await key(close(), 'ArrowRight')
  expect(dialog().textContent).not.toContain('unavailable')
  await act(async () => dialog().querySelector('img')!.dispatchEvent(new Event('error')))
  expect(dialog().textContent).toContain('unavailable')
  await key(close(), 'ArrowLeft')
  expect(dialog().querySelector('video')!.controls).toBe(true)
  expect(dialog().textContent).not.toContain('unavailable')
})

it('keeps the modal and current video usable through Strict Mode effect replay', async () => {
  const pending: (() => void)[] = []
  playback().mockImplementation(() => new Promise<void>((done) => pending.push(done)))
  await render(<StrictMode><PhotoshootGallery media={[clip]} title="Strict story">
    <button data-media-index={0}>Open film</button>
  </PhotoshootGallery></StrictMode>)
  await act(async () => trigger().click())
  expect(dialog()?.open).toBe(true)
  expect(dialog().querySelector('video')?.hasAttribute('src')).toBe(true)
  await expect.poll(() => dialog().querySelector('video')!.readyState).toBeGreaterThanOrEqual(1)
  const pauses = vi.mocked(HTMLMediaElement.prototype.pause).mock.calls.length
  await act(async () => pending[0]())
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(pauses)
  await key(close(), 'ArrowRight')
  expect(dialog()?.open).toBe(true)
})

it('allows explicit playback before public readiness and with reduced motion requested', async () => {
  const play = playback()
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
  await render(<PublicMediaReadiness routeKey="viewer-test">
    <PhotoshootGallery media={[clip]} title="Story"><button data-media-index={0}>Open film</button></PhotoshootGallery>
  </PublicMediaReadiness>)
  expect(document.querySelector('[data-public-media-ready]')?.getAttribute('data-public-media-ready')).toBe('false')
  await act(async () => trigger().click())
  expect(play).toHaveBeenCalledTimes(1)
  expect(dialog().querySelector('video')?.muted).toBe(false)
})

it('keeps revisioned photos optimizable without adding viewer images to critical readiness', async () => {
  await gallery([{ id: 'revisioned', url: '/__controlled__/photo.jpg', processingRevision: 3, alt: 'Full portrait' }])
  await act(async () => trigger().click())
  const image = dialog().querySelector('img')!
  expect(image.getAttribute('src')).toBe('/__controlled__/photo.jpg?v=3')
  expect(image.hasAttribute('data-unoptimized')).toBe(false)
  expect(image.sizes).toBe('100vw')
  expect(image.hasAttribute('data-public-critical')).toBe(false)
})
