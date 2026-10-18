// Historical verifier for 6944671's 200%-margin acquisition contract.
// Current readiness/viewport behavior: use scripts/verify-public-motion.mjs.
// pnpm exec tsx scripts/verify-homepage-video-delivery.mjs http://localhost:3108 [raw.json] [summary.json]
// A built application served by `pnpm start` is required. The script drives the
// public homepage on a mobile viewport and records the actual request log.
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.argv[2] || 'http://localhost:3108'
const output = process.argv[3]
const summaryOutput = process.argv[4]
const viewport = { width: 390, height: 844, dpr: 2 }
// Must match `videoAcquisitionRootMargin` in src/components/useDeferredVideoSource.ts.
const acquisitionViewportRatio = 2
const maxLoads = 10
const browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE_PATH
  ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {})
const report = {
  base, browser: browser.version(), generatedAt: new Date().toISOString(),
  viewport, acquisitionViewportRatio, loadsAttempted: 0, attempts: [], samples: [], failures: [],
}
const pathname = (url) => new URL(url, base).pathname
const identity = (url) => {
  const parsed = new URL(url, base)
  return `${parsed.pathname}${parsed.search}`
}
const playbackIdentity = (url) => pathname(url).endsWith('/playback') ? identity(url) : null
const isRawPoster = (url) => /^\/api\/media\/[^/]+\/poster$/.test(pathname(url))
  || /^\/media\/.*\/poster(\.[a-z0-9]+)?$/.test(pathname(url))
const optimizedPoster = (url) => pathname(url) === '/_next/image'
  && (new URL(url).searchParams.get('url') || '').includes('/poster')

const documentHtml = await (await fetch(base)).text()

function sample(page) {
  return page.evaluate(() => {
    const rect = (element) => element.getBoundingClientRect().toJSON()
    const videos = [...document.querySelectorAll('.masonry-card video')]
    const posters = [...document.querySelectorAll('.masonry-card img.media-poster')]
    const opening = [...document.querySelectorAll('.masonry-card[data-first-row="true"] img')]
    return {
      scrollY: window.scrollY,
      documentHeight: document.documentElement.scrollHeight,
      videos: videos.map((video, index) => {
        const poster = video.parentElement.querySelector('.media-poster')
        return {
          index, rect: rect(video), src: video.getAttribute('src'), preload: video.preload,
          poster: video.getAttribute('poster'), controls: video.controls, muted: video.muted,
          loop: video.loop, playsInline: video.playsInline, autoplay: video.autoplay,
          paused: video.paused, readyState: video.readyState,
          acquisitionEntries: window.__videoAcquisition?.get(video) || [],
          posterUrl: poster ? new URL(poster.currentSrc).searchParams.get('url') : null,
        }
      }),
      posters: posters.map((poster) => ({
        src: poster.getAttribute('src'), currentSrc: poster.currentSrc, loading: poster.loading,
        complete: poster.complete, naturalWidth: poster.naturalWidth, sizes: poster.sizes,
        rect: rect(poster),
      })),
      opening: opening.map((image) => ({
        src: image.currentSrc, loading: image.loading, priority: image.fetchPriority,
        complete: image.complete, naturalWidth: image.naturalWidth, rect: rect(image),
      })),
    }
  })
}

const acquisitionBandBottom = (dom) => Math.max(...dom.videos.flatMap((video) =>
  video.acquisitionEntries.map((entry) => entry.rootBottom).filter((bottom) => bottom != null)))

let page = null
let context = null
let requests = []
let initial = null
for (let attempt = 0; attempt < maxLoads && !initial; attempt += 1) {
  report.loadsAttempted = attempt + 1
  context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.dpr })
  page = await context.newPage()
  await page.addInitScript(() => {
    const NativeObserver = window.IntersectionObserver
    window.__videoAcquisition = new WeakMap()
    window.IntersectionObserver = class extends NativeObserver {
      constructor(callback, options) {
        super((entries, observer) => {
          if (options?.rootMargin === '200% 0px') {
            entries.forEach((entry) => {
              const history = window.__videoAcquisition.get(entry.target) || []
              history.push({ isIntersecting: entry.isIntersecting,
                top: entry.boundingClientRect.top, rootBottom: entry.rootBounds?.bottom })
              window.__videoAcquisition.set(entry.target, history)
            })
          }
          callback(entries, observer)
        }, options)
      }
    }
  })
  requests = []
  const session = await context.newCDPSession(page)
  await session.send('Network.enable')
  session.on('Network.requestWillBeSent', (event) => requests.push({
    url: event.request.url, type: event.type, timestamp: event.timestamp,
  }))
  const started = Date.now()
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const sampledAfterMs = Date.now() - started
  const dom = await sample(page)
  const bandBottom = acquisitionBandBottom(dom)
  const deferred = dom.videos.filter((video) => video.rect.top >= bandBottom
    && video.acquisitionEntries.length && !video.acquisitionEntries.some((entry) => entry.isIntersecting))
  report.attempts.push({
    attempt, sampledAfterMs, videos: dom.videos.length, deferred: deferred.length,
    videoTops: dom.videos.map((video) => Math.round(video.rect.top)), bandBottom: Math.round(bandBottom),
  })
  if (!deferred.length || sampledAfterMs >= 6000) {
    await context.close()
    context = null
    page = null
    continue
  }
  initial = { dom, deferred, sampledAfterMs }
}
try {
  assert(initial, `No homepage layout placed a video beyond the acquisition band in ${maxLoads} loads`)
  const { dom, deferred, sampledAfterMs } = initial
  const bandBottom = acquisitionBandBottom(dom)
  const acquiring = dom.videos.filter((video) => video.acquisitionEntries.some((entry) => entry.isIntersecting))
  const acquiringSources = acquiring.map((video) => video.src).filter(Boolean)
  const playbackRequests = requests.map((request) => playbackIdentity(request.url)).filter(Boolean)
  const rawPosterRequests = requests.filter((request) => isRawPoster(request.url))
  const posterRequests = requests.filter((request) => optimizedPoster(request.url))
  const posterWidths = posterRequests.map((request) => Number(new URL(request.url).searchParams.get('w')))
  const imageRequests = requests.filter((request) => request.type === 'Image')

  report.initial = {
    sampledAfterMs, bandBottom: Math.round(bandBottom), ...dom,
    playbackRequests, posterWidths,
    rawPosterRequests: rawPosterRequests.map((request) => request.url),
    requestCount: requests.length,
    documentVideoSource: /<video[^>]*\ssrc=/i.test(documentHtml),
    documentVideoPoster: /<video[^>]*\sposter=/i.test(documentHtml),
  }

  assert.equal(report.initial.documentVideoSource, false, 'SSR document attached a video playback source')
  assert.equal(report.initial.documentVideoPoster, false, 'SSR document attached a raw poster attribute')
  assert(dom.videos.length >= 1, 'No video slot rendered on the mobile homepage')
  assert(deferred.length >= 1, 'No offscreen video slot rendered')

  for (const video of deferred) {
    assert.equal(video.src, null, `Offscreen video acquired playback: ${video.src}`)
    assert.equal(video.preload, 'none', 'Offscreen video is not deferred')
    assert.equal(video.poster, null, 'Offscreen video kept a raw poster attribute')
    assert(video.muted && video.loop && video.playsInline, 'Homepage video lost mute/loop/inline')
    assert(!video.controls && !video.autoplay && video.paused, 'Homepage video is interactive or playing offscreen')
  }
  for (const video of acquiring) {
    assert(video.src, `In-band video did not acquire playback: ${JSON.stringify(video.rect)}`)
    assert.equal(video.preload, 'metadata', 'In-band video did not switch to metadata preload')
    assert(playbackRequests.includes(video.src), `In-band video playback was not requested: ${video.src}`)
  }
  for (const request of playbackRequests) {
    assert(acquiringSources.includes(request), `Playback requested for a deferred video: ${request}`)
  }

  assert.equal(rawPosterRequests.length, 0, `Unoptimized poster requested: ${rawPosterRequests.map((r) => r.url)}`)
  assert(posterRequests.length >= 1, 'No optimized poster request observed')
  posterRequests.forEach((request) => {
    const width = Number(new URL(request.url).searchParams.get('w'))
    assert(width > 0 && width <= 828, `Poster width is not card-appropriate: ${width}`)
    assert.equal(new URL(request.url).searchParams.get('q'), '75', 'Poster quality drifted')
  })
  assert(dom.posters.length >= deferred.length, 'A video slot lost its poster layer')
  dom.posters.forEach((poster) => {
    assert(poster.currentSrc.includes('/_next/image'), `Poster bypassed the optimized path: ${poster.currentSrc}`)
    assert(['lazy', 'eager'].includes(poster.loading), 'Poster has no explicit loading policy')
  })

  assert(dom.opening.length >= 2, 'Opening portfolio images are missing')
  dom.opening.forEach((image) => {
    assert.equal(image.loading, 'eager', 'Opening portfolio image is not eager')
    assert.equal(image.priority, 'high', 'Opening portfolio image lost high priority')
    assert(image.complete && image.naturalWidth > 0, 'Opening portfolio image failed to load')
  })
  dom.opening.forEach((image) => assert(imageRequests.some((request) => request.url === image.src),
    `Opening portfolio image was not requested: ${image.src}`))

  const target = deferred.reduce((deepest, video) => video.rect.top > deepest.rect.top ? video : deepest)
  const posterUrl = new URL(target.posterUrl, base)
  const expectedPlayback = `${posterUrl.pathname.replace(/\/poster$/, '/playback')}${posterUrl.search}`
  await page.evaluate((index) => {
    document.querySelectorAll('.masonry-card video')[index].setAttribute('data-verify-target', 'true')
  }, target.index)
  const beforeScrollPlayback = playbackRequests.length
  await page.evaluate(() => {
    const video = document.querySelector('[data-verify-target="true"]')
    window.scrollTo(0, Math.max(0, window.scrollY + video.getBoundingClientRect().top - window.innerHeight * 1.5))
  })
  await page.waitForTimeout(1000)
  const near = (await sample(page)).videos.find((video) => video.index === target.index)
  const nearPlayback = requests.map((request) => playbackIdentity(request.url)).filter(Boolean)

  report.nearViewport = { expectedPlayback, ...near, playbackRequests: nearPlayback }

  assert(near.rect.top >= viewport.height, 'Target video scrolled into view during the acquisition sample')
  assert.equal(near.src, expectedPlayback, 'Near-viewport video did not acquire the expected source')
  assert.equal(near.preload, 'metadata', 'Near-viewport video did not switch to metadata preload')
  assert(nearPlayback.includes(expectedPlayback), 'Near-viewport acquisition issued no playback request')
  assert.equal(nearPlayback.length > beforeScrollPlayback, true, 'Acquisition request log did not grow')
  assert.equal(near.paused, true, 'Offscreen-but-near video started playing')

  await page.evaluate(() => document.querySelector('[data-verify-target="true"]')
    .scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(1200)
  const playing = (await sample(page)).videos.find((video) => video.index === target.index)
  report.inView = playing

  assert.equal(playing.paused, false, 'In-view homepage video did not play')
  assert(playing.muted && playing.loop && playing.playsInline && !playing.controls,
    'In-view homepage video lost its non-interactive contract')
  console.log(`PASS mobile ${viewport.width}x${viewport.height} loads=${report.loadsAttempted} `
    + `videos=${dom.videos.length} deferred=${deferred.length} posters=${posterWidths.join(',')}w `
    + `playback=${nearPlayback.length}`)
} catch (error) {
  report.failures.push({ message: error.message, stack: error.stack })
  console.error(`FAIL mobile ${viewport.width}x${viewport.height}: ${error.message.split('\n')[0]}`)
} finally {
  if (context) await context.close()
  await browser.close()
  report.requests = requests
  if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
  if (summaryOutput) await writeFile(summaryOutput, `${JSON.stringify({
    base, browser: report.browser, generatedAt: report.generatedAt, viewport,
    loadsAttempted: report.loadsAttempted, attempts: report.attempts,
    failures: report.failures,
    initial: report.initial ? {
      sampledAfterMs: report.initial.sampledAfterMs, documentHeight: report.initial.documentHeight,
      bandBottom: report.initial.bandBottom,
      videos: report.initial.videos.map(({ index, rect, src, preload, poster, paused, posterUrl, acquisitionEntries }) =>
        ({ index, top: Math.round(rect.top), src, preload, poster, paused, posterUrl, acquisitionEntries })),
      posters: report.initial.posters.map(({ currentSrc, loading, naturalWidth, rect }) =>
        ({ currentSrc, loading, naturalWidth, top: Math.round(rect.top) })),
      opening: report.initial.opening.map(({ src, loading, priority, naturalWidth }) =>
        ({ src, loading, priority, naturalWidth })),
      posterWidths: report.initial.posterWidths,
      rawPosterRequests: report.initial.rawPosterRequests,
      playbackRequests: report.initial.playbackRequests,
      requestCount: report.initial.requestCount,
      documentVideoSource: report.initial.documentVideoSource,
      documentVideoPoster: report.initial.documentVideoPoster,
    } : null,
    nearViewport: report.nearViewport ? {
      expectedPlayback: report.nearViewport.expectedPlayback, src: report.nearViewport.src,
      preload: report.nearViewport.preload, top: Math.round(report.nearViewport.rect.top),
      paused: report.nearViewport.paused, playbackRequests: report.nearViewport.playbackRequests,
    } : null,
    inView: report.inView ? { src: report.inView.src, top: Math.round(report.inView.rect.top),
      paused: report.inView.paused, muted: report.inView.muted, loop: report.inView.loop,
      playsInline: report.inView.playsInline, controls: report.inView.controls } : null,
  }, null, 2)}\n`)
  console.log(JSON.stringify({ loadsAttempted: report.loadsAttempted, failures: report.failures.length }, null, 2))
}
if (report.failures.length) process.exitCode = 1
