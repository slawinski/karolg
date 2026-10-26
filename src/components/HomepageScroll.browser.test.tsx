import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'
import { HomepageScroll } from './HomepageScroll'
import '@/app/(frontend)/styles.css'

afterEach(async () => { await cleanup(); vi.unstubAllGlobals(); window.scrollTo({ top: 0, behavior: 'instant' }) })

it('owns one native-window smoother through StrictMode and releases it on preference loss', async () => {
  await page.viewport(1440, 900)
  const preference = Object.assign(new EventTarget(), { matches: true })
  vi.stubGlobal('matchMedia', () => preference)
  const view = await render(<StrictMode><HomepageScroll><div style={{ height: 5000 }} /></HomepageScroll></StrictMode>)
  expect(document.documentElement.classList.contains('lenis')).toBe(true)
  expect(getComputedStyle(document.documentElement).scrollBehavior).toBe('auto')
  window.scrollTo({ top: 300, behavior: 'instant' })
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
  await expect.poll(() => scrollY).toBe(300)
  preference.matches = false
  preference.dispatchEvent(new Event('change'))
  expect(document.documentElement.classList.contains('lenis')).toBe(false)
  expect(scrollY).toBe(300)
  preference.matches = true
  preference.dispatchEvent(new Event('change'))
  expect(document.documentElement.classList.contains('lenis')).toBe(true)
  await view.unmount()
  window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }))
  window.dispatchEvent(new Event('resize'))
  window.dispatchEvent(new Event('pageshow'))
  expect(document.documentElement.classList.contains('lenis')).toBe(false)
})

it('leaves mobile and reduced-motion visitors on native scrolling', async () => {
  await page.viewport(700, 900)
  await render(<HomepageScroll><div style={{ height: 3000 }} /></HomepageScroll>)
  expect(document.documentElement.classList.contains('lenis')).toBe(false)
  window.scrollTo({ top: 200, behavior: 'instant' })
  expect(scrollY).toBe(200)
})
