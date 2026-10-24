import { act, StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'
import { PortfolioFooter } from './PortfolioFooter'
import { PhotoshootGallery } from './PhotoshootGallery'
import '@/app/(frontend)/styles.css'

afterEach(async () => { await cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

async function fixture() {
  return render(<StrictMode><main id="top">
    <div style={{ height: 1800 }} data-preceding-content="" />
    <PortfolioFooter name="Carla Gorecka" statement="A creative approach to modeling" />
  </main></StrictMode>)
}

it('keeps footer links and copyright reachable at phone and landscape sizes', async () => {
  for (const [width, height] of [[390, 844], [844, 390]]) {
    await page.viewport(width, height)
    await fixture()
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })
    const copyright = document.querySelector('.portfolio-footer__copyright')!
    await expect.poll(() => copyright.getBoundingClientRect().bottom).toBeLessThanOrEqual(height)
    expect(document.documentElement.scrollWidth).toBe(width)
    for (const link of document.querySelectorAll<HTMLAnchorElement>('.portfolio-footer a')) {
      expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
      link.focus()
      expect(getComputedStyle(link).outlineStyle).not.toBe('none')
    }
    await cleanup()
  }
})

const footer = () => document.querySelector<HTMLElement>('.portfolio-footer')!
const shade = () => Number(getComputedStyle(document.querySelector('.portfolio-footer__shade')!).opacity)
const shift = () => new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.portfolio-footer__inner')!).transform).m42
async function reveal(progress: number) {
  const top = footer().getBoundingClientRect().top + window.scrollY
  await act(async () => window.scrollTo({ top: top - innerHeight * (1 - progress), behavior: 'instant' }))
}

it('scrubs parallax and shading in both scroll directions', async () => {
  await page.viewport(1366, 768)
  await fixture()
  const height = document.querySelector('.portfolio-footer__inner')!.getBoundingClientRect().height
  for (const progress of [0, .5, 1, .5, 0]) {
    await reveal(progress)
    await expect.poll(shade).toBeCloseTo(.5 - .4 * progress, 2)
    expect(shift()).toBeCloseTo(-.25 * (1 - progress) * height, 0)
  }
})

it('resamples layout changes and makes focused navigation fully readable', async () => {
  await page.viewport(1366, 768)
  await fixture()
  await reveal(.5)
  await expect.poll(shade).toBeCloseTo(.3, 2)
  document.querySelector<HTMLElement>('[data-preceding-content]')!.style.height = '1900px'
  await expect.poll(() => Math.abs(shade() - .3)).toBeGreaterThan(.01)
  document.querySelector<HTMLAnchorElement>('.portfolio-footer a')!.focus({ preventScroll: true })
  await expect.poll(shift).toBe(0)
  expect(shade()).toBe(.1)
})

it('responds to live motion preferences and cancels work on unmount', async () => {
  const preference = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal('matchMedia', () => preference)
  await page.viewport(1366, 768)
  const view = await fixture()
  await reveal(.5)
  await expect.poll(shade).toBeCloseTo(.3, 2)
  preference.matches = true
  preference.dispatchEvent(new Event('change'))
  expect(shift()).toBe(0)
  expect(shade()).toBe(.1)
  preference.matches = false
  preference.dispatchEvent(new Event('change'))
  expect(shade()).toBeCloseTo(.3, 2)
  const removed = footer()
  const before = removed.getAttribute('style')
  window.dispatchEvent(new Event('scroll'))
  await view.unmount()
  await new Promise(requestAnimationFrame)
  preference.matches = true
  preference.dispatchEvent(new Event('change'))
  expect(removed.getAttribute('style')).toBe(before)
})

it('preserves footer progress through viewer dismissal and route unmount', async () => {
  await page.viewport(1366, 768)
  const media = [{ id: 1, url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', alt: 'Portrait' }]
  const view = await render(<main>
    <div style={{ height: 1800 }} />
    <PhotoshootGallery media={media} title="Story">
      <button data-media-index={0}>Open portrait</button>
    </PhotoshootGallery>
    <PortfolioFooter />
  </main>)
  const opener = document.querySelector<HTMLButtonElement>('[data-media-index]')!
  for (const method of ['button', 'Escape']) {
    await reveal(.5)
    await expect.poll(shade).toBeCloseTo(.3, 2)
    const y = scrollY
    await act(async () => opener.click())
    expect(document.querySelector('dialog')?.matches(':modal')).toBe(true)
    await new Promise(requestAnimationFrame)
    expect(shade()).toBeCloseTo(.3, 2)
    if (method === 'Escape') await userEvent.keyboard('{Escape}')
    else await act(async () => document.querySelector<HTMLButtonElement>('.photoshoot-viewer-close')!.click())
    await expect.poll(() => document.querySelector('dialog')).toBeNull()
    expect(scrollY).toBe(y)
    expect(document.activeElement).toBe(opener)
    await expect.poll(shade).toBeCloseTo(.3, 2)
  }
  await act(async () => opener.click())
  await view.unmount()
  expect(document.body.style.position).not.toBe('fixed')
})

it('activates a partially revealed link on the first pointer click', async () => {
  await page.viewport(1366, 768)
  await fixture()
  await reveal(.5)
  await expect.poll(shade).toBeCloseTo(.3, 2)
  const link = document.querySelector<HTMLAnchorElement>('.portfolio-footer a')!
  let activations = 0
  link.addEventListener('click', (event) => { event.preventDefault(); activations++ })
  await userEvent.click(link)
  expect(activations).toBe(1)
  expect(shade()).toBeCloseTo(.3, 2)
})
