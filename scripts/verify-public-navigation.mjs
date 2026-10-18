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
