import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const directory = await mkdtemp(path.join(tmpdir(), 'social-runtime-'))
const listener = createServer()
await new Promise<void>((resolve) => listener.listen(0, '127.0.0.1', resolve))
const address = listener.address()
assert(address && typeof address === 'object')
const port = address.port
await new Promise<void>((resolve) => listener.close(() => resolve()))
const base = `http://127.0.0.1:${port}`
Object.assign(process.env, {
  PAYLOAD_SECRET: randomBytes(32).toString('hex'), NODE_ENV: 'production',
  DATABASE_URL: `file:${path.join(directory, 'fixture.db')}`,
  MEDIA_STATIC_DIR: path.join(directory, 'media'), DISABLE_MEDIA_JOB_AUTORUN: '1',
  NEXT_PUBLIC_SITE_URL: base,
})
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const { default: sharp } = await import('sharp')
const payload = await getPayload({ config })
let server: ReturnType<typeof spawn> | undefined
try {
  await payload.db.migrate()
  const build = spawnSync('pnpm', ['build'], { stdio: 'inherit', timeout: 180_000 })
  assert.equal(build.status, 0)
  await payload.create({ collection: 'projects', data: { title: 'Social fixture shoot', slug: 'social-fixture' } })
  const file = async (background: string) => {
    const data = await sharp({ create: { width: 1200, height: 630, channels: 3, background } }).jpeg().toBuffer()
    return { name: 'social.jpg', data, mimetype: 'image/jpeg', size: data.length }
  }
  const media = await payload.create({ collection: 'media', data: { kind: 'image', processingStatus: 'ready', processingRevision: 0, alt: 'Social QA image' }, file: await file('blue') })
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], { stdio: 'inherit' })
  const html = async (route: string) => {
    const response = await fetch(`${base}${route}`, { headers: { 'User-Agent': 'Twitterbot/1.0' }, signal: AbortSignal.timeout(15_000) })
    assert.equal(response.status, 200)
    return response.text()
  }
  for (let tries = 0; ; tries++) {
    try { await html('/'); break } catch (error) { if (tries > 50) throw error; await delay(200) }
  }
  const imageTag = (markup: string) => markup.match(/<meta property="og:image" content="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&')
  assert.equal(imageTag(await html('/')), undefined)
  await payload.updateGlobal({ slug: 'site-settings', data: { socialImage: media.id } })
  for (const route of ['/', '/work/social-fixture']) {
    const markup = await html(route)
    const head = markup.split('</head>')[0]
    assert.equal(imageTag(head), `${base}/api/media/file/social.jpg?v=1`)
    assert(head.includes('name="twitter:card" content="summary_large_image"'))
    assert(head.includes(`name="twitter:image" content="${base}/api/media/file/social.jpg?v=1"`))
    assert(head.includes('property="og:image:width" content="1200"'))
    if (route.includes('work')) {
      assert(head.includes('property="og:title" content="Social fixture shoot — Carla Gorecka"'))
    }
    const response = await fetch(imageTag(head)!)
    assert.equal(response.status, 200)
    assert(response.headers.get('content-type')?.includes('image/jpeg'))
    const originalPixels = await sharp(Buffer.from(await response.arrayBuffer())).stats()
    assert(originalPixels.channels[2].mean > 240 && originalPixels.channels[0].mean < 10)
    console.log(`PASS ${route}: public revisioned image and OG/Twitter tags in crawler head`)
  }
  await payload.update({ collection: 'media', id: media.id, data: {}, file: await file('red'), overwriteExistingFiles: true })
  assert.equal(imageTag(await html('/')), `${base}/api/media/file/social.jpg?v=2`)
  const replacement = await fetch(`${base}/api/media/file/social.jpg?v=2`)
  assert.equal(replacement.status, 200)
  const replacementPixels = await sharp(Buffer.from(await replacement.arrayBuffer())).stats()
  assert(replacementPixels.channels[0].mean > 240 && replacementPixels.channels[2].mean < 10)
  console.log('PASS same-file image replacement updates sharing URL without rebuild')
  await payload.updateGlobal({ slug: 'site-settings', data: { socialImage: null } })
  assert.equal(imageTag(await html('/')), undefined)
  console.log('PASS clearing the field removes image metadata without rebuild')
} finally {
  if (server && server.exitCode === null) {
    const exit = new Promise<void>((resolve) => server!.once('exit', () => resolve()))
    server.kill('SIGTERM')
    await exit
  }
  await payload.destroy()
  await rm(directory, { recursive: true, force: true })
}
