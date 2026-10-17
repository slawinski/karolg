// pnpm exec tsx scripts/verify-photoshoot-candidates.mjs http://localhost:3107 [raw.json] [summary.json]
// A built application is required. No CMS writes; controlled documents are
// intercepted only inside fresh browser contexts, never installed as app routes.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import nextImage from 'next/image.js'
import { selectPhotoshootCandidates } from '../src/lib/photoshoot-candidates.ts'
import { candidateViewports, controlledMedia, controlledVideo, regressionPhotoshoot } from '../src/test/fixtures/photoshoot-candidates.ts'

const Image = nextImage.default || nextImage
const base = process.argv[2] || 'http://localhost:3107'
const output = process.argv[3]
const summaryOutput = process.argv[4]
const browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE_PATH
  ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {})
const report = { base, browser: browser.version(), generatedAt: new Date().toISOString(), rows: [], failures: [] }
const identity = (url) => {
  if (!url) return null
  const parsed = new URL(url, base)
  return parsed.pathname === '/_next/image' ? parsed.searchParams.get('url') : parsed.pathname
}
const headerImages = (header = '') => [...header.matchAll(/<([^>]*)>([^<]*?)(?=,\s*<|$)/g)]
  .filter(([, , attributes]) => /\bas\s*=\s*"?image\b/i.test(attributes))
  .map(([, href, attributes]) => identity((attributes.match(/imagesrcset="([^"]+)"/i)?.[1] || href).split(' ')[0]))
const documentResponse = await fetch(`${base}/work/A`)
assert.equal(documentResponse.status, 200)
const template = await documentResponse.text()
report.documentSHA256 = createHash('sha256').update(template).digest('hex')
const videoResponse = await fetch(`${base}/api/media?where[kind][equals]=video&where[processingStatus][equals]=ready&limit=1`)
const publicVideo = (await videoResponse.json()).docs?.[0]
assert(publicVideo?.playbackUrl && publicVideo?.posterUrl, 'A public ready-video test resource is required')
const sizes = template.match(/<img\b[^>]*sizes="([^"]+)"/)?.[1]
assert(sizes, 'Production sizes required')

// Actual Next Image + React SSR, not the browser-test plain-image alias.
function controlledDocument(media, title, unoptimized = false) {
  const selected = selectPhotoshootCandidates(media)
  const gallery = renderToStaticMarkup(React.createElement('section', { className: 'photoshoot-gallery' },
    media.map((item, index) => React.createElement('figure', {
      key: index, className: `photoshoot-gallery-item photoshoot-gallery-item-${index % 7 + 1} image-frame`,
    }, item.kind === 'video'
      ? React.createElement('video', { className: 'visual-img visual-video', src: item.playbackUrl,
        poster: item.posterUrl, controls: true, playsInline: true, preload: 'metadata' })
      : React.createElement(Image, { src: item.url, alt: `Slot ${index}`, fill: true, sizes,
        className: 'visual-img', loading: selected.has(item.url) ? 'eager' : 'lazy',
        fetchPriority: selected.has(item.url) ? 'high' : undefined, unoptimized })))))
  // Remove the original document's image hints and RSC/client scripts, retaining
  // real build stylesheet/header/head. Fixture SSR is not claimed as route hydration.
  return template.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<link\b(?=[^>]*as="image")[^>]*>/g, '')
    // Unlike Next's deferred scripts, a script-free fixture does not make DCL
    // wait for CSS. Force the stylesheet barrier before sampling rectangles.
    .replace(/(<link\b(?=[^>]*rel="stylesheet")[^>]*>)/g, '$1<script>getComputedStyle(document.documentElement).getPropertyValue("--paper")</script>')
    .replace(/(<section class="photoshoot-head"><h1>)[\s\S]*?(<\/h1>)/, `$1${title}$2`)
    .replace(/<section class="photoshoot-gallery"[\s\S]*?<\/section>/, gallery)
}

async function navigate(label, viewport, { html, javaScriptEnabled = true, repeat = false } = {}) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.dpr, javaScriptEnabled })
  const page = await context.newPage()
  const network = []
  const earlyHints = []
  const session = await context.newCDPSession(page)
  await session.send('Network.enable')
  session.on('Network.responseReceivedEarlyHints', (event) => earlyHints.push(event.headers))
  session.on('Network.requestWillBeSent', (event) => {
    if (event.type === 'Image') network.push({ id: event.requestId, url: event.request.url,
      identity: identity(event.request.url), initialPriority: event.request.initialPriority,
      initiator: event.initiator.type, timestamp: event.timestamp })
  })
  session.on('Network.resourceChangedPriority', (event) => {
    const request = network.find((item) => item.id === event.requestId)
    if (request) request.finalPriority = event.newPriority
  })
  if (html) await page.route(`${base}/work/A`, (route) => route.fulfill({ contentType: 'text/html', body: html }))
  await page.addInitScript(() => {
    window.__photoEvidence = { lcp: [], shifts: [], mutations: [] }
    const evidence = window.__photoEvidence
    new PerformanceObserver((list) => list.getEntries().forEach((entry) => {
      const element = entry.element
      evidence.lcp.push({ url: entry.url, size: entry.size, startTime: entry.startTime,
        tag: element?.tagName, loading: element?.loading, priority: element?.fetchPriority,
        rect: element?.getBoundingClientRect().toJSON() })
    })).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((list) => list.getEntries().forEach((entry) => {
      if (!entry.hadRecentInput) evidence.shifts.push({ value: entry.value,
        gallery: entry.sources.some((source) => source.node?.closest?.('.photoshoot-gallery')) })
    })).observe({ type: 'layout-shift', buffered: true })
    new MutationObserver((records) => records.forEach((record) => {
      if (record.target.matches?.('.photoshoot-gallery img')) evidence.mutations.push({
        attribute: record.attributeName, value: record.target.getAttribute(record.attributeName),
      })
    })).observe(document, { subtree: true, attributes: true, attributeFilter: ['loading', 'fetchpriority'] })
    document.addEventListener('DOMContentLoaded', () => {
      evidence.initialRects = [...document.querySelectorAll('.photoshoot-gallery figure')]
        .map((element) => element.getBoundingClientRect().toJSON())
    })
  })
  try {
    const response = await page.goto(`${base}/work/A`, { waitUntil: 'networkidle' })
    const source = await response.text()
    const headers = await response.allHeaders()
    await page.waitForTimeout(500)
    const observed = await page.evaluate(() => {
      const images = [...document.querySelectorAll('.photoshoot-gallery img')].map((image) => ({
        src: image.getAttribute('src'), currentSrc: image.currentSrc, sizes: image.sizes,
        loading: image.loading, priority: image.fetchPriority, complete: image.complete,
        naturalWidth: image.naturalWidth, rect: image.getBoundingClientRect().toJSON(),
      }))
      return { title: document.querySelector('h1')?.textContent, images,
        hints: [...document.querySelectorAll('link[rel=preload][as=image]')].map((link) => ({
          href: link.href, srcset: link.imageSrcset, sizes: link.imageSizes, priority: link.fetchPriority,
        })), videos: [...document.querySelectorAll('.photoshoot-gallery video')].map((video) => ({
          preload: video.preload, controls: video.controls, playsInline: video.playsInline,
          poster: video.poster, autoplay: video.autoplay, paused: video.paused,
        })), rects: [...document.querySelectorAll('.photoshoot-gallery figure')].map((element) => element.getBoundingClientRect().toJSON()),
        evidence: window.__photoEvidence || null,
        resources: performance.getEntriesByType('resource').filter((entry) => entry.initiatorType === 'img' || entry.initiatorType === 'link')
          .map((entry) => ({ name: entry.name, initiator: entry.initiatorType, startTime: entry.startTime, transferSize: entry.transferSize })),
      }
    })
    const imageTags = source.match(/<img\b[^>]*>/g) || []
    const sourceUrgent = imageTags.filter((tag) => /loading="eager"|fetchPriority="high"/i.test(tag))
      .map((tag) => identity(tag.match(/\bsrc="([^"]+)"/)?.[1].replaceAll('&amp;', '&')))
    const hintTags = source.match(/<link\b(?=[^>]*as="image")[^>]*>/g) || []
    const hintIdentities = hintTags.map((tag) => identity((tag.match(/(?:imageSrcSet|href)="([^"]+)"/i)?.[1] || '').split(' ')[0].replaceAll('&amp;', '&')))
    const hydratedUrgent = observed.images.filter((image) => image.loading === 'eager' || image.priority === 'high').map((image) => identity(image.src))
    const headerIdentities = [headers, ...earlyHints].flatMap((hintHeaders) =>
      headerImages(Object.entries(hintHeaders).find(([key]) => key.toLowerCase() === 'link')?.[1]))
    const union = [...new Set([...sourceUrgent, ...hintIdentities, ...headerIdentities, ...hydratedUrgent])]
    const areas = observed.images.map((image) => image.rect.width * Math.max(0,
      Math.min(viewport.height, image.rect.bottom) - Math.max(0, image.rect.top)))
    const largest = Math.max(0, ...areas)
    const winners = observed.images.filter((_, index) => largest > 0 && Math.abs(areas[index] - largest) < 1).map((image) => identity(image.src))
    const lastLcp = observed.evidence?.lcp.at(-1)
    const row = { label, viewport, javaScriptEnabled, fixtureHydration: html ? 'SSR-only controlled document' : 'real production route',
      linkHeader: headers.link || null, earlyHints, headerIdentities,
      sourceUrgent, hintIdentities, hydratedUrgent, union, winners, lastLcp, network: [...network], ...observed }
    report.rows.push(row)
    assert(union.length <= 4, `${label}: global urgent union exceeds FOUR`)
    assert.deepEqual([...new Set(hydratedUrgent)].sort(), [...new Set(sourceUrgent)].sort(), 'Hydration membership changed')
    assert(hintIdentities.every((url) => sourceUrgent.includes(url)), 'Hint outside SSR set')
    assert(winners.length === 0 || winners.some((url) => union.includes(url)), `Uncovered largest visible still: ${winners}`)
    if (javaScriptEnabled && lastLcp?.tag === 'IMG') assert(union.includes(identity(lastLcp.url)), `Uncovered actual image LCP: ${lastLcp.url}`)
    if (javaScriptEnabled) {
      assert(JSON.stringify(observed.rects) === JSON.stringify(observed.evidence.initialRects), 'Hydration/load changed reserved rectangles')
      assert.equal(observed.evidence.shifts.filter((shift) => shift.gallery).length, 0, 'Gallery layout shift')
      assert.equal(observed.evidence.mutations.length, 0, 'Hydration changed loading/priority')
    }
    observed.videos.forEach((video) => {
      assert(video.controls && video.playsInline && video.paused && !video.autoplay && video.poster)
      assert.equal(video.preload, 'metadata')
    })
    for (const url of union) {
      const image = observed.images.find((item) => identity(item.src) === url)
      assert(image.complete && image.naturalWidth > 0, `Failed image: ${url}`)
      assert.equal(image.loading, 'eager')
      assert.equal(image.priority, 'high')
      const requests = network.filter((request) => request.identity === url)
      assert.equal(requests.length, 1, `Duplicate responsive/fallback transfer: ${url}`)
      assert(requests.some((request) => request.initialPriority === 'High' || request.initialPriority === 'VeryHigh'), `Not initially high priority: ${url}`)
    }
    if (label === 'actual' && viewport.width === 390 && viewport.height === 844) {
      assert.equal(observed.title, regressionPhotoshoot.title)
      assert.equal(observed.images.length, 9)
      assert(observed.images.every((image, index) => identity(image.src).endsWith(regressionPhotoshoot.filenames[index])), 'Public baseline content drift')
      assert(sourceUrgent.includes('/api/media/file/IMG_3912.JPG'))
      assert.equal(new URL(observed.images[5].currentSrc).searchParams.get('w'), '384')
      assert.equal(observed.images[5].rect.width, 191)
      if (javaScriptEnabled) assert.equal(lastLcp?.tag, 'IMG', 'Exact baseline requires actual image LCP telemetry')
    }
    if (repeat) {
      const cached = await page.reload({ waitUntil: 'networkidle' })
      row.repeatDocumentStatus = cached.status()
      row.repeatRequests = network.slice(row.network.length)
      const membership = await page.locator('.photoshoot-gallery img[loading=eager]').evaluateAll((images) => images.map((image) => image.getAttribute('src')))
      assert.deepEqual(membership.map(identity).sort(), [...new Set(sourceUrgent)].sort())
    }
    console.log(`PASS ${label} ${viewport.width}x${viewport.height} JS=${javaScriptEnabled} urgent=${union.length} LCP=${lastLcp?.url || lastLcp?.tag || 'unavailable'}`)
  } catch (error) {
    report.failures.push({ label, viewport, javaScriptEnabled, message: error.message })
    console.error(`FAIL ${label} ${viewport.width}x${viewport.height}: ${error.message.split('\n')[0]}`)
  } finally { await context.close() }
}

try {
  for (const viewport of candidateViewports) {
    await navigate('actual', viewport, { repeat: true })
    await navigate('actual-no-js', viewport, { javaScriptEnabled: false })
  }
  // Use public test resources for optimized requests. Different slot identities
  // remain distinct, even though their bytes come from existing public images.
  const fixtures = [1, 2, 6, 7, 14].map((count) => ({ label: `length-${count}`, media: controlledMedia(count) }))
  const mixed = controlledMedia(14)
  mixed[0] = controlledVideo
  mixed[5] = { ...controlledVideo, id: 'interleaved-video' }
  fixtures.push({ label: 'mixed-14', media: mixed })
  for (const { label, media } of fixtures) {
    const publicMedia = media.map((item, index) => item.kind === 'video'
      ? { ...item, playbackUrl: publicVideo.playbackUrl, posterUrl: publicVideo.posterUrl }
      : { ...item, url: `/api/media/file/${regressionPhotoshoot.filenames[index % 9]}?verification-slot=${index}` })
    for (const title of ['A', 'Editorial Portraits', 'Editorial Portraits in Natural Light', Array(60).fill('Portraits').join(' ')]) {
      const html = controlledDocument(publicMedia, title)
      for (const viewport of candidateViewports) await navigate(`${label}:${title.length}`, viewport, { html })
    }
  }
  // Unoptimized SSR follows the static-export image configuration without
  // overwriting the production .next build or exporting a mutable CMS snapshot.
  const staticMedia = regressionPhotoshoot.filenames.map((filename) => ({ kind: 'image', url: `/api/media/file/${filename}` }))
  await navigate('unoptimized-static-config', candidateViewports[0], { html: controlledDocument(staticMedia, 'A', true) })
} finally {
  await browser.close()
  if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
  if (summaryOutput) await writeFile(summaryOutput, `${JSON.stringify({
    base, browser: report.browser, generatedAt: report.generatedAt,
    documentSHA256: report.documentSHA256, rawEvidence: output || null,
    failures: report.failures,
    rows: report.rows.map((row) => ({
      label: row.label, viewport: row.viewport, javaScriptEnabled: row.javaScriptEnabled,
      fixtureHydration: row.fixtureHydration, selected: row.union, winners: row.winners,
      lcp: row.lastLcp, repeatDocumentStatus: row.repeatDocumentStatus,
      loadingPriorityMutations: row.evidence?.mutations.length ?? null,
      galleryShifts: row.evidence?.shifts.filter((shift) => shift.gallery).length ?? null,
      headerIdentities: row.headerIdentities,
      urgentRequests: row.network.filter((request) => row.union.includes(request.identity))
        .map(({ url, initialPriority, initiator }) => ({ url, initialPriority, initiator })),
      repeatUrgentRequests: row.repeatRequests?.filter((request) => row.union.includes(request.identity))
        .map(({ url, initialPriority, initiator }) => ({ url, initialPriority, initiator })),
    })),
  }, null, 2)}\n`)
  console.log(JSON.stringify({ rows: report.rows.length, failures: report.failures }, null, 2))
}
if (report.failures.length) process.exitCode = 1
