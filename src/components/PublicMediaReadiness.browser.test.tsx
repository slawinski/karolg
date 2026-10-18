import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render } from 'vitest-browser-react'
import { PublicMediaReadiness, usePublicMediaReady } from './PublicMediaReadiness'

function Status() { return <output>{String(usePublicMediaReady())}</output> }
afterEach(async () => { await cleanup(); vi.restoreAllMocks() })

it('resumes readiness when mounted in a hidden document before the first frame', async () => {
  const original = Object.getOwnPropertyDescriptor(document, 'visibilityState')
  let visible = false
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visible ? 'visible' : 'hidden' })
  try {
    await render(<PublicMediaReadiness routeKey="hidden"><Status /></PublicMediaReadiness>)
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(document.querySelector('output')!.textContent).toBe('false')
    visible = true
    document.dispatchEvent(new Event('visibilitychange'))
    await expect.poll(() => document.querySelector('output')!.textContent, { timeout: 3000 }).toBe('true')
  } finally {
    if (original) Object.defineProperty(document, 'visibilityState', original)
    else Reflect.deleteProperty(document, 'visibilityState')
  }
})

it('waits for a cached critical image to decode before opening readiness', async () => {
  let decode!: () => void
  vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(() => new Promise<void>((resolve) => { decode = resolve }))
  await render(<PublicMediaReadiness routeKey="decode"><img data-public-critical /><Status /></PublicMediaReadiness>)
  await new Promise((resolve) => setTimeout(resolve, 1600))
  expect(document.querySelector('output')!.textContent).toBe('false')
  decode()
  await expect.poll(() => document.querySelector('output')!.textContent).toBe('true')
})

it('keeps pending critical content ahead of motion, including failed images', async () => {
  await render(<PublicMediaReadiness routeKey="a"><img data-public-critical src="/__controlled__/pending.jpg" /><Status /></PublicMediaReadiness>)
  expect(document.querySelector('output')!.textContent).toBe('false')
  document.querySelector('img')!.dispatchEvent(new Event('error'))
  await expect.poll(() => document.querySelector('output')!.textContent, { timeout: 3000 }).toBe('true')
})

it('settles cached images and empty routes, resetting on route identity', async () => {
  const view = await render(<PublicMediaReadiness routeKey="a"><img data-public-critical src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" /><Status /></PublicMediaReadiness>)
  await expect.poll(() => document.querySelector('output')!.textContent, { timeout: 3000 }).toBe('true')
  await view.rerender(<PublicMediaReadiness routeKey="b"><Status /></PublicMediaReadiness>)
  expect(document.querySelector('output')!.textContent).toBe('false')
  await expect.poll(() => document.querySelector('output')!.textContent, { timeout: 3000 }).toBe('true')
})
