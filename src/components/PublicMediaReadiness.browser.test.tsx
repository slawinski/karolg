import { afterEach, expect, it } from 'vitest'
import { cleanup, render } from 'vitest-browser-react'
import { PublicMediaReadiness, usePublicMediaReady } from './PublicMediaReadiness'

function Status() { return <output>{String(usePublicMediaReady())}</output> }
afterEach(cleanup)

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
