import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { closeSync, openSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import type { Payload } from 'payload'
import { browserScenarios, runPublicSmokeJourney } from './public-smoke-journey'
import {
  assertSmokeCheckout, seedPublicSmokeFixture, stopSmokeChild, waitForSmokeChild,
  type PublicSmokeFixture,
} from './public-smoke-fixture'

const artifacts = path.resolve('artifacts/ci/public-smoke')
const report = {
  status: 'running' as 'running' | 'passed' | 'failed',
  scenario: 'fixture-http', phase: 'setup', step: 'preflight',
  browserScenarios,
  url: null as string | null, viewport: null as { width: number; height: number } | null, motion: null as string | null,
  checks: {} as Record<string, 'passed' | 'failed' | 'not-run'>,
  fixture: null as PublicSmokeFixture | null,
  logs: [] as string[],
  error: null as string | null, cleanupErrors: [] as string[], evidenceErrors: [] as string[],
}
const steps = ['preflight', 'media-tools', 'environment', 'payload', 'migrate', 'seed', 'build', 'server', 'fixture-http', 'browser-journey']
for (const step of steps) report.checks[step] = 'not-run'
const errorMessage = (error: unknown) => error instanceof Error ? error.stack || error.message : String(error)
const persist = () => writeFile(path.join(artifacts, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
let directory: string | undefined
let payload: Payload | undefined
let command: ChildProcess | undefined
let server: ChildProcess | undefined
let serverError: Error | undefined
let primaryError: unknown

function start(commandName: string, args: string[], logName: string) {
  const fd = openSync(path.join(artifacts, logName), 'w')
  report.logs.push(logName)
  try {
    // A process group lets cleanup include build workers, not only their parent.
    return spawn(commandName, args, { env: process.env, detached: true, stdio: ['ignore', fd, fd] })
  } finally { closeSync(fd) }
}

async function run(commandName: string, args: string[], logName: string, timeout: number) {
  command = start(commandName, args, logName)
  await waitForSmokeChild(command, timeout)
  command = undefined
}

async function step(name: string, action: () => Promise<void>) {
  report.step = name
  await persist()
  await action()
  report.checks[name] = 'passed'
  await persist()
}

try {
  // Reporting exists even when preflight refuses this checkout. Never inspect .env contents.
  await mkdir(artifacts, { recursive: true })
  await persist()
  await step('preflight', async () => { assertSmokeCheckout(process.cwd()) })
  await step('media-tools', async () => {
    await run('ffmpeg', ['-version'], 'ffmpeg.log', 10_000)
    await run('ffprobe', ['-version'], 'ffprobe.log', 10_000)
  })
  let port = 0
  let base = ''
  await step('environment', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'karolg-public-smoke-'))
    const listener = createServer()
    await new Promise<void>((resolve, reject) => {
      listener.once('error', reject)
      listener.listen(0, '127.0.0.1', resolve)
    })
    const address = listener.address()
    assert(address && typeof address === 'object')
    port = address.port
    await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()))
    base = `http://127.0.0.1:${port}`
    Object.assign(process.env, {
      NODE_ENV: 'production', PAYLOAD_SECRET: randomBytes(32).toString('hex'),
      DATABASE_URL: `file:${path.join(directory, 'fixture.db')}`,
      MEDIA_STATIC_DIR: path.join(directory, 'media'),
      DISABLE_MEDIA_JOB_AUTORUN: '1', NEXT_PUBLIC_SITE_URL: base,
      FFMPEG_PATH: 'ffmpeg', FFPROBE_PATH: 'ffprobe',
    })
  })
  await step('payload', async () => {
    const { getPayload } = await import('payload')
    const { default: config } = await import('../src/payload.config')
    payload = await getPayload({ config })
  })
  await step('migrate', async () => { await payload!.db.migrate() })
  await step('seed', async () => {
    const videoPath = path.join(directory!, 'smoke-motion.mp4')
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i',
      'testsrc2=size=180x240:rate=12', '-t', '1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-y', videoPath],
    'fixture.log', 30_000)
    report.fixture = await seedPublicSmokeFixture(payload!, videoPath)
  })
  await step('build', async () => {
    process.env.NODE_OPTIONS = '--no-deprecation --max-old-space-size=4096'
    await run(process.execPath, ['node_modules/next/dist/bin/next', 'build'], 'build.log', 180_000)
  })
  await step('server', async () => {
    server = start(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], 'server.log')
    server.on('error', (error) => { serverError = error })
    const deadline = Date.now() + 60_000
    report.url = base
    while (true) {
      if (serverError) throw serverError
      assert(server.exitCode === null && server.signalCode === null, 'Production server exited before readiness')
      try {
        const response = await fetch(base, { signal: AbortSignal.timeout(3000) })
        await response.body?.cancel()
        if (response.ok) break
      } catch { /* Bounded polling while Next starts listening. */ }
      assert(Date.now() < deadline, 'Production server readiness timed out')
      await delay(200)
    }
  })
  await step('fixture-http', async () => {
    report.phase = 'http'
    const fixture = report.fixture!
    const get = async (route: string, mime: string) => {
      report.url = new URL(route, base).href
      assert.equal(new URL(report.url).origin, base, 'Fixture URLs must stay on the disposable origin')
      await persist()
      const response = await fetch(report.url, { signal: AbortSignal.timeout(15_000), redirect: 'error' })
      assert.equal(response.status, 200, `${route} must be public`)
      assert(response.headers.get('content-type')?.includes(mime), `${route} must serve ${mime}`)
      const body = Buffer.from(await response.arrayBuffer())
      assert(body.length > 0, `${route} must not be empty`)
      return body
    }
    const home = (await get('/', 'text/html')).toString()
    assert(home.includes(`/work/${fixture.story.slug}`), 'Home must expose the fixture story')
    assert(home.includes(`mailto:${fixture.email}`), 'Home must expose the seeded email')
    const story = (await get(`/work/${fixture.story.slug}`, 'text/html')).toString()
    assert(story.includes(`<h1>${fixture.story.title}</h1>`), 'Story must render the fixture heading')
    const media = JSON.parse((await get('/api/media?depth=0&limit=10', 'application/json')).toString())
    assert.equal(media.totalDocs, 4, 'Only the four synthetic media may be published')
    for (const item of [...fixture.images, fixture.video]) {
      const stored = media.docs.find((doc: { id: number }) => doc.id === item.id)
      assert(stored, `Media ${item.id} must be public`)
      assert.equal(stored.photoshoot, fixture.story.id)
      assert.equal(stored.processingStatus, 'ready')
    }
    const { default: sharp } = await import('sharp')
    for (const image of fixture.images) {
      const stored = media.docs.find((doc: { id: number }) => doc.id === image.id)
      assert.equal(stored.url, image.url)
      assert.equal(stored.sizes?.card?.url, image.cardUrl)
      assert.equal(stored.sizes?.hero?.url, image.heroUrl)
      for (const url of [image.url, image.cardUrl, image.heroUrl]) {
        const { info } = await sharp(await get(url, 'image/jpeg')).raw().toBuffer({ resolveWithObject: true })
        assert(info.width && info.height, 'Fixture images must decode')
      }
    }
    const storedVideo = media.docs.find((doc: { id: number }) => doc.id === fixture.video.id)
    assert.equal(storedVideo.processingRevision, fixture.video.revision)
    assert.equal(storedVideo.posterUrl, fixture.video.posterUrl)
    assert.equal(storedVideo.playbackUrl, fixture.video.playbackUrl)
    const { info: poster } = await sharp(await get(fixture.video.posterUrl, 'image/jpeg')).raw().toBuffer({ resolveWithObject: true })
    assert(poster.width && poster.height, 'Video poster must decode')
    await get(fixture.video.playbackUrl, 'video/mp4')
  })
  await step('browser-journey', async () => {
    report.phase = 'browser'
    report.scenario = 'browser-setup'
    await runPublicSmokeJourney(base, report.fixture!, artifacts, async (scenario) => {
      report.scenario = scenario.name
      report.step = scenario.step
      report.url = scenario.url
      report.viewport = scenario.viewport
      report.motion = scenario.motion
      await persist()
    })
  })
  report.status = 'passed'
} catch (error) {
  primaryError = error
  report.status = 'failed'
  report.checks[report.phase === 'browser' ? 'browser-journey' : report.step] = 'failed'
  report.error = errorMessage(error)
} finally {
  const cleanup = async (action: () => Promise<unknown>) => {
    try { await action() } catch (error) { report.cleanupErrors.push(errorMessage(error)) }
  }
  if (command) await cleanup(() => stopSmokeChild(command!))
  if (server) await cleanup(() => stopSmokeChild(server!))
  if (payload) await cleanup(async () => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        payload!.destroy(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Payload cleanup timed out after 10000ms')), 10_000)
        }),
      ])
    } finally { clearTimeout(timer) }
  })
  if (directory) await cleanup(() => rm(directory!, { recursive: true, force: true }))
  if (report.cleanupErrors.length) report.status = 'failed'
  try { await persist() } catch (error) {
    report.evidenceErrors.push(errorMessage(error))
    console.error('Could not persist public smoke report', error)
    process.exitCode = 1
  }
}
if (primaryError || report.status === 'failed') {
  console.error(primaryError || report.cleanupErrors.join('\n'))
  process.exitCode = 1
  // A timed-out destroy may leave handles alive; the report is already flushed.
  if (report.cleanupErrors.length) process.exit(1)
} else console.log('PASS public smoke fixture HTTP lifecycle and mobile, desktop, reduced-motion visitor journeys')
