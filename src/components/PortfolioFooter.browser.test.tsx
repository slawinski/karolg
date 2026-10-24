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
