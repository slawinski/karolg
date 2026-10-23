import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'
import { PhotoshootGallery } from './PhotoshootGallery'
import type { MediaLike } from '@/lib/media'
import '@/app/(frontend)/styles.css'

const pixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const photos: MediaLike[] = Array.from({ length: 9 }, (_, i) => ({ id: i, url: pixel, alt: `Portrait ${i + 1}` }))
afterEach(cleanup)

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
  const touch = (x: number, y: number) => new Touch({ identifier: 1, target, clientX: x, clientY: y })
  await act(async () => {
    target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: multiple ? [touch(150, 150), touch(160, 150)] : [touch(150, 150)] }))
    target.dispatchEvent(new TouchEvent(kind, { bubbles: true, changedTouches: [touch(150 + dx, 150 + dy)] }))
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
