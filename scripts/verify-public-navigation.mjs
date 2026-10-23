// node scripts/verify-public-navigation.mjs BASE OUTPUT
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { writeFile } from 'node:fs/promises'
const [base, output] = process.argv.slice(2)
let browser
const report = { routes: [], checks: [] }
try {
  const sitemapResponse = await fetch(new URL('/sitemap.xml', base))
  assert.equal(sitemapResponse.status, 200, 'Sitemap discovery failed')
  const sitemap = await sitemapResponse.text()
  assert(/<urlset(?:\s[^>]*)?>[\s\S]*<\/urlset>/.test(sitemap), 'Expected a sitemap URL list')
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, loc]) => {
    const canonical = new URL(loc.trim().replaceAll('&amp;', '&'))
    assert(['http:', 'https:'].includes(canonical.protocol), 'Expected an HTTP sitemap URL')
    const target = new URL(base)
    target.pathname = canonical.pathname
    target.search = canonical.search
    target.hash = ''
    return target
  })
  assert(urls.length > 0, 'Sitemap URL list is empty')
  for (const url of urls) {
    const response = await fetch(url)
    const html = await response.text()
    report.routes.push({ path: url.pathname, url: url.href, status: response.status })
    assert.equal(response.status, 200, `Route failed: ${url.href}`)
    assert(html.includes('<h1'), `Route has no heading: ${url.href}`)
  }
  browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  const photoshoot = urls.find((url) => url.pathname.startsWith('/work/'))
  assert(photoshoot, 'Expected a photoshoot for navigation checks')
  const assertPhotoshootTop = async (entry) => {
    await page.waitForFunction(() => document.querySelector('.photoshoot-head h1'))
    const firstFrame = await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(window.scrollY))))
    assert.equal(firstFrame, 0, `${entry} did not start at the top immediately`)
    await page.waitForFunction(() => document.querySelector('[data-public-media-ready="true"]'))
    assert.equal(await page.evaluate(() => window.scrollY), 0, `${entry} retained the previous scroll position`)
    const heading = await page.locator('h1').boundingBox()
    assert(heading && heading.y >= 0 && heading.y < page.viewportSize().height, `${entry} hid the photoshoot title`)
  }
  const assertRestoredScroll = async (entry) => {
    await page.waitForFunction(() => document.querySelector('[data-public-media-ready="true"]'))
    await page.waitForFunction(() => Math.abs(window.scrollY - 500) <= 1)
    assert.equal(await page.evaluate(() => window.history.scrollRestoration), 'auto', `${entry} changed the browser restoration policy`)
  }
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }))
    assert(await page.evaluate(() => window.scrollY > 0), 'Homepage must be scrolled before entry')
    // DOM click exercises Next Link without Playwright scrolling the card back into view first.
    await page.locator(`a[href="${photoshoot.pathname}"]`).first().evaluate((link) => link.click())
    await page.waitForURL(photoshoot.href)
    await assertPhotoshootTop(`Client entry at ${width}px`)
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }))
    assert(await page.evaluate(() => window.scrollY > 0), 'Photoshoot must remain freely scrollable')
    await page.reload({ waitUntil: 'networkidle' })
    await assertRestoredScroll(`Reload at ${width}px`)
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }))
    await page.locator('a[href="/#work"]').first().evaluate((link) => link.click())
    await page.waitForURL((url) => url.pathname === '/' && url.hash === '#work')
    await page.waitForFunction(() => document.querySelector('[data-public-media-ready="true"]'))
    const work = await page.locator('#work').boundingBox()
    assert(work && work.y < page.viewportSize().height && work.y + work.height > 0, 'Selected work anchor missed its target')
    await page.goBack()
    await page.waitForURL(photoshoot.href)
    await assertRestoredScroll(`Back entry at ${width}px`)
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }))
    await page.goBack()
    await page.waitForURL((url) => url.pathname === '/')
    assert.equal(await page.evaluate(() => window.history.scrollRestoration), 'auto', 'Photoshoot policy leaked onto homepage history')
    await page.goForward()
    await page.waitForURL(photoshoot.href)
    await assertRestoredScroll(`Forward entry at ${width}px`)
    await page.goBack()
    await page.waitForURL((url) => url.pathname === '/')
    await page.waitForFunction(() => document.querySelector('[data-public-media-ready="true"]'))
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }))
    await page.locator(`a[href="${photoshoot.pathname}"]`).first().evaluate((link) => link.click())
    await page.waitForURL(photoshoot.href)
    await assertPhotoshootTop(`Cached client entry at ${width}px`)
    report.checks.push(`Fresh and cached photoshoot links start at the top immediately; reload, Back and Forward restore saved scroll at ${width}px`)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('a[href="/#about"]').first().evaluate((link) => link.click())
  await page.waitForURL((url) => url.pathname === '/' && url.hash === '#about')
  await page.waitForFunction(() => document.querySelector('[data-public-media-ready="true"]'))
  const profile = await page.locator('#about').boundingBox()
  assert(profile && profile.y < page.viewportSize().height && profile.y + profile.height > 0, 'Profile anchor missed its target')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.locator(`a[href="${photoshoot.pathname}"]`).first().evaluate((link) => link.click())
  await page.waitForURL(photoshoot.href)
  await assertPhotoshootTop('Reduced-motion client entry')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  report.checks.push('Work/profile anchors remain usable and reduced-motion navigation starts at the top')
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }))
  assert(await page.evaluate(() => window.scrollY > 0), 'Photoshoot must be scrolled before delayed reload')
  let releaseReloadImages
  const reloadImagesReleased = new Promise((resolve) => { releaseReloadImages = resolve })
  const delayReloadImages = async (route) => {
    if (route.request().resourceType() === 'image') await reloadImagesReleased
    await route.continue()
  }
  await page.route('**/*', delayReloadImages)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    assert.equal(await page.evaluate(() => document.readyState), 'interactive', 'Images must still delay reload')
    releaseReloadImages()
    await page.waitForLoadState('load')
    await assertRestoredScroll('Reload after delayed images')
    report.checks.push('Delayed reload preserves native photoshoot scroll restoration')
  } finally {
    releaseReloadImages()
    await page.unroute('**/*', delayReloadImages)
  }
  let releaseImages
  const imagesReleased = new Promise((resolve) => { releaseImages = resolve })
  const delayImages = async (route) => {
    if (route.request().resourceType() === 'image') await imagesReleased
    await route.continue()
  }
  await page.route('**/*', delayImages)
  try {
    await page.goto(photoshoot.href, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    await page.mouse.wheel(0, 500)
    await page.waitForFunction(() => window.scrollY > 0)
    assert.equal(await page.evaluate(() => document.readyState), 'interactive', 'Images must still delay load')
    releaseImages()
    await page.waitForLoadState('load')
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    assert(await page.evaluate(() => window.scrollY > 0), 'Late image loading reset deliberate visitor scrolling')
    report.checks.push('Late image loading preserves deliberate scrolling after photoshoot entry')
  } finally {
    releaseImages()
    await page.unroute('**/*', delayImages)
  }
  await page.route('**/_next/image?**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('url')?.includes('/poster')) {
      await new Promise((done) => setTimeout(done, 3000))
    }
    await route.continue()
  })
  await page.goto(new URL('/work/d', base).href, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  assert.equal(await page.locator('video[src]').count(), 0, 'Pending critical poster did not block acquisition')
  await page.waitForFunction(() => document.querySelector('[data-public-media-ready="true"]'))
  await page.waitForFunction(() => [...document.querySelectorAll('video')].some((v) => !v.paused))
  report.checks.push('Delayed critical poster blocks real playback requests; autoplay follows readiness')
  await page.unrouteAll({ behavior: 'wait' })
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelector('[data-public-media-ready="true"]'))
  await page.locator('a[href="/work/d"]').first().click()
  await page.waitForURL('**/work/d')
  assert.equal(await page.locator('[data-public-media-ready="false"]').count(), 1, 'Client navigation did not reset readiness')
  assert.equal(await page.locator('video[src]').count(), 0)
  await page.waitForFunction(() => [...document.querySelectorAll('video')].some((v) => !v.paused))
  report.checks.push('Actual Next Link navigation resets readiness and resumes silent autoplay')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  assert.equal(await page.locator('video[src]').count(), 0)
  assert.equal(await page.locator('video[controls]').count(), 0)
  report.checks.push('Reduced motion suppresses acquisition before initial readiness with no controls')
  await context.close()
} finally {
  await browser?.close()
  await writeFile(output, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}
