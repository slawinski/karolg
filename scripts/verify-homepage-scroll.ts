// Read-only actual-App-Router proof; run against an already running application.
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium, type Page } from 'playwright'

const base = process.env.SCROLL_TEST_URL || 'http://localhost:3000'
const directory = await mkdtemp(path.join(tmpdir(), 'viv-masonry-'))
const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars', '--disable-back-forward-cache'] })
const results: Record<string, unknown> = { base, directory, checks: [] }
const checks = results.checks as string[]
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, recordVideo: { dir: directory } })
await context.addInitScript(() => {
  window.addEventListener('pageshow', (event) => {
    ;(window as unknown as { restoredFromBFCache: boolean }).restoredFromBFCache = event.persisted
  })
})
const page = await context.newPage()
const errors: string[] = []
page.on('pageerror', (error) => errors.push(error.message))
const ready = async (page: Page, enabled = true) => {
  await page.waitForSelector('.cursor-masonry')
  await page.waitForFunction((enabled) => document.documentElement.classList.contains('lenis') === enabled, enabled)
}
const samples = (page: Page, count = 70) => page.evaluate(async (count) => {
  const frames = []
  for (let i = 0; i < count; i++) {
    await new Promise(requestAnimationFrame)
    frames.push({ time: performance.now(), y: scrollY, columns: [...document.querySelectorAll('.cursor-masonry__column')].map((column) => new DOMMatrix(getComputedStyle(column).transform).m42) })
  }
  return frames
}, count)
const atTarget = async (id: string) => {
  await page.waitForFunction((id) => {
    const target = document.getElementById(id)!
    const destination = Math.min(target.getBoundingClientRect().top + scrollY, document.documentElement.scrollHeight - innerHeight)
    return Math.abs(scrollY - destination) < 3
  }, id)
}
try {
  for (const width of [1440, 1000]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(base)
    await ready(page)
    await page.mouse.move(width / 2, 600)
    await page.mouse.wheel(0, 120)
    const down = await samples(page)
    assert(new Set(down.map((frame) => frame.y)).size > 3, 'Native page must glide over multiple frames')
    assert(down.some((frame) => Math.abs(frame.columns[1] - frame.columns[2]) > 5), 'Column catch-up times must differ')
    assert(down.at(-1)!.columns.every((offset) => Math.abs(offset + 60) < 1), 'Columns must share the final -60px target')
    await page.screenshot({ path: path.join(directory, `desktop-${width}-down.png`) })
    await page.mouse.wheel(0, -120)
    const up = await samples(page)
    assert(up.at(-1)!.columns.every((offset) => Math.abs(offset) < 1), 'Upward input must reveal the cropped images again')
    results[`motion-${width}`] = { down, up }
    checks.push(`trusted wheel glide, independent catch-up, crop/reverse at ${width}px`)
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  for (const hash of ['work', 'about']) {
    await page.goto('about:blank')
    await page.goto(`${base}/#${hash}`)
    await ready(page)
    await atTarget(hash)
    assert.equal(new URL(page.url()).hash, `#${hash}`)
    checks.push(`direct /#${hash}`)
  }
  for (const [href, id] of [['/#work', 'work'], ['/#about', 'about'], ['#top', 'top']]) {
    await page.keyboard.press('End')
    await page.waitForFunction(() => scrollY >= document.documentElement.scrollHeight - innerHeight - 3)
    await page.mouse.move(900, 500)
    await page.mouse.wheel(0, -120)
    await page.locator(`.portfolio-footer a[href="${href}"]`).click()
    await atTarget(id)
    assert.equal(new URL(page.url()).hash, `#${id}`)
    const stable = await samples(page, 20)
    assert(Math.abs(stable.at(-1)!.y - stable[0].y) < 3, 'Old inertia must not replay after a link')
    checks.push(`first-click ${href} during unfinished glide`)
  }
  await page.goto(base)
  await ready(page)
  await page.mouse.move(400, 600)
  await page.mouse.wheel(0, 400)
  await page.keyboard.press('End')
  await page.waitForFunction(() => scrollY >= document.documentElement.scrollHeight - innerHeight - 3)
  checks.push('End wins over active inertia and reaches footer')
  await page.locator('.portfolio-footer a').first().focus()
  assert.equal(await page.locator('.portfolio-footer__shade').evaluate((node) => Number(getComputedStyle(node).opacity)), .1)
  await page.screenshot({ path: path.join(directory, 'footer-focused.png') })
  await page.keyboard.press('Home')
  await page.waitForFunction(() => scrollY === 0)
  await page.mouse.wheel(0, 100)
  await page.keyboard.press('PageDown')
  const keyed = await samples(page)
  assert(keyed.at(-1)!.y > 500, 'PageDown must override the old 100px wheel target')
  checks.push('PageDown wins over active inertia')

  await page.keyboard.press('Home')
  await page.waitForFunction(() => scrollY === 0)
  await page.mouse.wheel(0, 600)
  const scrollbar = await page.evaluate(() => ({
    width: innerWidth - document.documentElement.clientWidth,
    x: innerWidth - 6,
    thumbMiddle: (scrollY + innerHeight / 2) / document.documentElement.scrollHeight * innerHeight,
  }))
  assert(scrollbar.width > 0, 'This run must expose a real native scrollbar')
  await page.mouse.move(scrollbar.x, scrollbar.thumbMiddle)
  await page.mouse.down()
  await page.mouse.move(scrollbar.x, 900, { steps: 12 })
  await page.mouse.up()
  const dragged = await samples(page)
  assert(dragged.at(-1)!.y > 1500, 'Native scrollbar dragging must win over the old 600px target')
  assert(Math.abs(dragged.at(-1)!.y - dragged.at(-10)!.y) < 3, 'Scrollbar position must not rebound')
  checks.push('native scrollbar thumb drag wins over inertia without rebound')

  await page.evaluate(() => {
    const input = document.createElement('textarea')
    input.id = 'scroll-editable-probe'
    input.value = 'editable text'
    input.style.cssText = 'position:fixed;top:20px;left:20px;z-index:9999'
    document.body.append(input)
    input.focus({ preventScroll: true })
    input.setSelectionRange(0, 0)
  })
  const beforeEditing = await page.evaluate(() => scrollY)
  await page.keyboard.press('End')
  assert.equal(await page.evaluate(() => scrollY), beforeEditing)
  await page.locator('#scroll-editable-probe').evaluate((node) => node.remove())
  checks.push('page-scroll keys inside an editable control retain editing behavior')

  await page.goto(base)
  await ready(page)
  await page.mouse.wheel(0, 100)
  const link = page.locator('.masonry-card__link').first()
  const work = await link.getAttribute('href')
  await link.click()
  await page.waitForURL(`**${work}`)
  await page.waitForFunction(() => !document.documentElement.classList.contains('lenis'))
  checks.push('real media link during glide disposes homepage smoother')
  await page.goBack()
  await ready(page)
  const returned = await samples(page, 30)
  assert(Math.abs(returned.at(-1)!.y - returned[0].y) < 3)
  await page.mouse.wheel(0, 120)
  const resumed = await samples(page)
  const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)
  assert(Math.abs(resumed.at(-1)!.y - Math.min(maxScroll, returned.at(-1)!.y + 120)) < 3)
  await page.goForward()
  await page.waitForURL(`**${work}`)
  await page.goBack()
  await ready(page)
  checks.push('Back/Forward restoration and resumed wheel remain usable')
  await page.mouse.wheel(0, 120)
  await page.goto(`${base}${work}`)
  await page.goBack()
  await ready(page)
  const fullNavigationReturn = await samples(page, 30)
  assert(Math.abs(fullNavigationReturn.at(-1)!.y - fullNavigationReturn[0].y) < 3)
  results.bfcachePersisted = await page.evaluate(() => (window as unknown as { restoredFromBFCache: boolean }).restoredFromBFCache)
  checks.push('full-document history return retains usable native position')
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
  const restored = await samples(page, 20)
  assert(Math.abs(restored.at(-1)!.y - restored[0].y) < 3)
  checks.push('synthetic persisted pageshow synchronizes without replay')

  for (const hash of ['work', 'about']) {
    await page.goto(`${base}${work}`)
    await page.locator(`.portfolio-footer a[href="/#${hash}"]`).click()
    await page.waitForURL(`${base}/#${hash}`)
    await ready(page)
    await atTarget(hash)
    await page.goBack()
    await page.waitForURL(`**${work}`)
    await page.goForward()
    await ready(page)
    assert.equal(new URL(page.url()).hash, `#${hash}`)
    checks.push(`work-route native /#${hash} and browser Back/Forward preserve URL`)
  }

  await page.mouse.wheel(0, 120)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await ready(page, false)
  assert(await page.locator('.cursor-masonry__column').evaluateAll((columns) => columns.every((column) => !(column as HTMLElement).style.transform)))
  await page.keyboard.press('End')
  await page.locator('.portfolio-footer a[href="#top"]').click()
  await atTarget('top')
  await page.screenshot({ path: path.join(directory, 'reduced-motion.png') })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await ready(page)
  checks.push('live reduced-motion disposal, native navigation and re-enable')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('about:blank')
  await page.goto(`${base}/#about`)
  await ready(page, false)
  await atTarget('about')
  await page.locator('.portfolio-footer a[href="/#work"]').click()
  await atTarget('work')
  assert.equal(new URL(page.url()).hash, '#work')
  checks.push('fresh reduced-motion /#about to /#work preserves the native hash')

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const touch = await touchContext.newPage()
  await touch.goto(`${base}/#about`)
  await ready(touch, false)
  await touch.locator('.portfolio-footer').scrollIntoViewIfNeeded()
  await touch.locator('.portfolio-footer a[href="#top"]').tap()
  await touch.waitForFunction(() => scrollY === 0)
  await touch.screenshot({ path: path.join(directory, 'touch.png') })
  await touchContext.close()
  checks.push('coarse touch native anchors and unchanged spacing')
  const coarseContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true })
  const coarse = await coarseContext.newPage()
  await coarse.goto(base)
  await ready(coarse, false)
  assert.equal(await coarse.locator('.cursor-masonry__rail').evaluate((node) => parseFloat(getComputedStyle(node).columnGap)), 21.6)
  await coarse.screenshot({ path: path.join(directory, 'wide-coarse.png') })
  await coarseContext.close()
  checks.push('wide coarse-pointer spacing and native scrolling preserved')
  assert.deepEqual(errors, [])
  results.status = 'passed'
} catch (error) {
  results.status = 'failed'
  results.error = String(error)
  results.failureState = await page.evaluate(() => ({ url: location.href, y: scrollY, root: document.documentElement.className, targets: ['top', 'work', 'about'].map((id) => ({ id, top: document.getElementById(id)?.getBoundingClientRect().top })) }))
  await page.screenshot({ path: path.join(directory, 'failure.png') })
  throw error
} finally {
  results.pageErrors = errors
  await context.close()
  await browser.close()
  await writeFile(path.join(directory, 'evidence.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify({ ...results, 'motion-1440': undefined, 'motion-1000': undefined }, null, 2))
}
