// node scripts/summarize-public-cold-load.mjs ARTIFACT_DIRECTORY SUMMARY.json
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const [directory, output] = process.argv.slice(2)
const summary = { lighthouse: [], traces: [], checks: {}, artifacts: [] }
const artifact = async (file) => {
  const contents = await readFile(`${directory}/${file}`, 'utf8')
  summary.artifacts.push({ file, sha256: createHash('sha256').update(contents).digest('hex') })
  return JSON.parse(contents)
}
for (const file of (await readdir(directory)).filter((name) => /^cold-lh-.*[123]\.json$/.test(name))) {
  const r = await artifact(file)
  const metric = (name) => r.audits[name]?.numericValue
  summary.lighthouse.push({ file, lighthouse: r.lighthouseVersion, browser: r.environment.hostUserAgent,
    requestedUrl: r.requestedUrl, fetchTime: r.fetchTime,
    throttlingMethod: r.configSettings.throttlingMethod, formFactor: r.configSettings.formFactor,
    score: r.categories.performance.score, fcp: metric('first-contentful-paint'),
    lcp: metric('largest-contentful-paint'), tbt: metric('total-blocking-time'),
    cls: metric('cumulative-layout-shift'), speedIndex: metric('speed-index'),
    robots: r.audits['robots-txt']?.score, runtimeError: r.runtimeError,
    screen: r.configSettings.screenEmulation, throttling: r.configSettings.throttling,
    chunks: r.audits['network-requests']?.details?.items?.filter((r) => r.resourceType === 'Script')
      .map(({ url, transferSize }) => ({ url: new URL(url).pathname, transferSize })),
  })
}
for (const version of ['before', 'after', 'resumed', 'resumed-still']) {
  const r = await artifact(version.startsWith('resumed') ? `cold-load-${version}.json` : `cold-load-${version}-controlled.json`)
  summary.traces.push({ version, browser: r.browser, protocol: r.protocol, runs: r.runs.map((run) => {
    // This static mixed gallery has both video posters in the mobile viewport.
    // Include native baseline posters as well as optimized replacement layers;
    // comparing only eager <img>s would change the cutoff between versions.
    const posterEnd = run.path === '/work/d' ? Math.max(0, ...run.resources
      .filter((r) => decodeURIComponent(r.name).includes('/poster')).map((r) => r.responseEnd)) : null
    return ({
    path: run.path, repeat: run.repeat, cache: run.cache, lcp: run.lcp, cls: run.cls, blocking: run.blocking,
    bytesBeforeCritical: run.bytesBeforeCritical, criticalEnd: run.criticalEnd,
    documentBytes: run.navigation.decodedBodySize, ttfb: run.navigation.responseStart - run.navigation.requestStart,
    criticalImages: run.images.map((image) => new URL(image.src).pathname + new URL(image.src).search),
    playbackBeforeCritical: run.resources.filter((r) => r.name.includes('/playback') && r.startTime < run.criticalEnd).length,
    posterEnd,
    completedResourceBytesAtPosterReady: posterEnd === null ? null : run.resources
      .filter((r) => r.responseEnd <= posterEnd).reduce((sum, r) => sum + r.transferSize, 0),
  }) }) })
}
for (const file of ['public-motion-chromium-final.json', 'public-motion-webkit.json',
  'public-navigation.json', 'public-navigation-resumed.json', 'public-freshness.json', 'public-empty-gallery.json']) {
  summary.checks[file] = await artifact(file)
}
await writeFile(output, JSON.stringify(summary, null, 2))
for (const r of summary.lighthouse) console.log(JSON.stringify({ file: r.file, score: r.score, fcp: r.fcp,
  lcp: r.lcp, tbt: r.tbt, cls: r.cls, speedIndex: r.speedIndex, robots: r.robots }))
const distribution = (values) => {
  const sorted = values.toSorted((a, b) => a - b)
  return { median: sorted[Math.floor(sorted.length / 2)], min: sorted[0], max: sorted.at(-1) }
}
for (const trace of summary.traces) for (const path of new Set(trace.runs.map((run) => run.path))) {
  for (const cache of ['cold', 'warm']) {
    const runs = trace.runs.filter((run) => run.path === path && run.cache === cache)
    console.log(JSON.stringify({ version: trace.version, path, cache,
      lcp: distribution(runs.map((r) => r.lcp)), blocking: distribution(runs.map((r) => r.blocking)),
      cls: distribution(runs.map((r) => r.cls)), documentBytes: distribution(runs.map((r) => r.documentBytes)),
      posterReadyBytes: distribution(runs.map((r) => r.completedResourceBytesAtPosterReady)),
    }))
  }
}
