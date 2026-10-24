import { act, StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'
import { PortfolioFooter } from './PortfolioFooter'
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
