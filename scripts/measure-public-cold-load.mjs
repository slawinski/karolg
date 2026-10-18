// node scripts/measure-public-cold-load.mjs BASE OUTPUT [PATH ...]
// Fresh browser caches; server optimizer caches deliberately not purged.
import { chromium } from 'playwright'
import { writeFile } from 'node:fs/promises'

const [base, output, ...paths] = process.argv.slice(2)
const browser = await chromium.launch()
const report = { base, browser: browser.version(), at: new Date().toISOString(),
  protocol: '390x844 DPR2, 4x CPU, 150ms RTT / 1.6Mbps down / 750Kbps up; warm optimizer', runs: [] }
for (const path of paths.length ? paths : ['/']) {
  for (let repeat = 0; repeat < 3; repeat++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150,
      downloadThroughput: 1600000 / 8, uploadThroughput: 750000 / 8 })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.addInitScript(() => {
      window.__metrics = { lcp: 0, cls: 0, blocking: 0, shifts: [] }
      new PerformanceObserver((list) => list.getEntries().forEach((e) => { window.__metrics.lcp = e.startTime }))
        .observe({ type: 'largest-contentful-paint', buffered: true })
      new PerformanceObserver((list) => list.getEntries().forEach((e) => {
        if (!e.hadRecentInput) { window.__metrics.cls += e.value; window.__metrics.shifts.push({
          time: e.startTime, value: e.value, sources: e.sources.map((s) => ({
            node: s.node?.className, previous: s.previousRect, current: s.currentRect })) }) }
      })).observe({ type: 'layout-shift', buffered: true })
      new PerformanceObserver((list) => list.getEntries().forEach((e) => {
        window.__metrics.blocking += Math.max(0, e.duration - 50)
      })).observe({ type: 'longtask', buffered: true })
    })
    for (const cache of ['cold', 'warm']) {
      const response = await page.goto(new URL(path, base).href, { waitUntil: 'domcontentloaded', timeout: 90000 })
      // Capture the opening identities before a later swap replaces eager nodes.
      const openingImages = await page.locator('img[loading="eager"]').evaluateAll((images) =>
        images.map((image) => ({ src: image.currentSrc || image.src })))
      await page.waitForTimeout(12000)
      const sample = await page.evaluate((openingImages) => {
        const resources = performance.getEntriesByType('resource').map((r) => r.toJSON())
        const criticalEnd = Math.max(0, ...openingImages.map((img) =>
          resources.find((r) => r.name === img.src)?.responseEnd || 0))
        return { ...window.__metrics, navigation: performance.getEntriesByType('navigation')[0].toJSON(),
          fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
          criticalEnd, bytesBeforeCritical: resources.filter((r) => r.responseEnd <= criticalEnd)
            .reduce((sum, r) => sum + r.transferSize, 0),
          images: openingImages,
          videos: [...document.querySelectorAll('video')].map((v) => ({ src: v.getAttribute('src'),
            paused: v.paused, muted: v.muted, controls: v.controls })), resources }
      }, openingImages)
      const robots = await context.request.get(new URL('/robots.txt', base).href)
      report.runs.push({ path, repeat, cache, status: response.status(), robots: { status: robots.status(), body: await robots.text() }, ...sample })
      await writeFile(output, JSON.stringify(report, null, 2))
      console.log(JSON.stringify({ path, repeat, cache, lcp: sample.lcp, cls: sample.cls,
        blocking: sample.blocking, bytesBeforeCritical: sample.bytesBeforeCritical }))
    }
    await context.close()
  }
}
await browser.close()
await writeFile(output, JSON.stringify(report, null, 2))
