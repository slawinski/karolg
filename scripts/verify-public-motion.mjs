// node scripts/verify-public-motion.mjs BASE OUTPUT [chromium|webkit]
import assert from 'node:assert/strict'
import { chromium, webkit } from 'playwright'
import { writeFile } from 'node:fs/promises'

const [base, output, engine = 'chromium'] = process.argv.slice(2)
const browser = await ({ chromium, webkit })[engine].launch()
const report = { base, engine, browser: browser.version(), samples: [], failures: [] }
try {
  for (const width of [390, 700, 900, 1440, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 })
    const page = await context.newPage()
    const requests = []
    page.on('request', (request) => requests.push(request.url()))
    await page.addInitScript(() => {
      window.__acquisitions = []
      window.__swaps = 0
      document.addEventListener('animationend', (e) => { if (e.animationName === 'gallery-column-move') window.__swaps++ })
      new MutationObserver(() => document.querySelectorAll('video[src]').forEach((video) => {
        if (video.dataset.observedSource === video.getAttribute('src')) return
        video.dataset.observedSource = video.getAttribute('src')
        window.__acquisitions.push({ src: video.getAttribute('src'), time: performance.now(),
          ready: video.closest('[data-public-media-ready]')?.getAttribute('data-public-media-ready') })
      })).observe(document, { childList: true, attributes: true, subtree: true, attributeFilter: ['src'] })
    })
    await page.goto(new URL('/work/d', base).href, { waitUntil: 'domcontentloaded' })
    const before = await page.locator('figure').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()))
    await page.waitForFunction(() => document.querySelector('[data-public-media-ready="true"]'))
    await page.waitForFunction(() => [...document.querySelectorAll('video')].some((v) => !v.paused && v.currentTime > 0), undefined, { timeout: 15000 })
    const videos = await page.locator('video').evaluateAll((nodes) => nodes.map((v) => ({
      src: v.getAttribute('src'), controls: v.controls, muted: v.muted, inline: v.playsInline, playing: !v.paused,
      poster: v.getAttribute('poster'), label: v.getAttribute('aria-label'),
    })))
    const after = await page.locator('figure').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()))
    assert.deepEqual(before, after, 'Poster/play changed figure rectangles')
    assert(videos.every((v) => !v.controls && v.muted && v.inline && !v.poster && v.label))
    const acquisitions = await page.evaluate(() => window.__acquisitions)
    assert(acquisitions.every((a) => a.ready === 'true' && a.time >= 1500), 'Playback acquired before readiness')
    assert(!requests.some((url) => new URL(url).pathname.match(/^\/api\/media\/\d+\/poster$/)), 'Raw poster duplicate')
    await page.screenshot({ path: `${output}-${width}.png` })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForFunction(() => [...document.querySelectorAll('video')].every((v) => v.paused))
    report.samples.push({ width, videos, acquisitions, figuresStable: true, rawPosterRequests: 0 })
    await context.close()
  }
  report.home = []
  for (const width of [390, 700, 900, 1440, 1920]) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  await page.addInitScript(() => {
    window.__swaps = 0
    window.__cls = 0
    document.addEventListener('animationend', (e) => { if (e.animationName === 'gallery-column-move') window.__swaps++ })
    new PerformanceObserver((list) => list.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls += e.value }))
      .observe({ type: 'layout-shift', buffered: true })
  })
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(35000)
  const home = await page.evaluate(() => ({ swaps: window.__swaps, cls: window.__cls,
    videos: [...document.querySelectorAll('video')].map((v) => ({ src: v.getAttribute('src'), playing: !v.paused })) }))
  report.home.push({ width, ...home })
  assert(home.swaps >= 4, 'Did not observe multiple swap cycles')
  assert.equal(home.cls, 0, 'Homepage shifted during swaps')
  await page.locator('.masonry-card video').first().evaluate((video) => video.scrollIntoView({ block: 'center' }))
  await page.waitForFunction(() => [...document.querySelectorAll('video')].some((v) => !v.paused && v.currentTime > 0))
  report.home.at(-1).autoplayAfterProgrammaticScroll = true
  await page.screenshot({ path: `${output}-home-${width}.png` })
  await context.close()
  }
} catch (error) {
  report.failures.push({ message: error.message, stack: error.stack })
  process.exitCode = 1
} finally {
  await browser.close()
  await writeFile(output, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}
