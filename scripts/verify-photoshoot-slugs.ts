// Production-only regression: CMS slugs must not be limited to the build snapshot.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const directory = await mkdtemp(path.join(tmpdir(), 'karolg-slugs-'))
Object.assign(process.env, {
  NODE_ENV: 'production',
  PAYLOAD_SECRET: randomBytes(32).toString('hex'),
  DATABASE_URL: `file:${path.join(directory, 'fixture.db')}`,
  MEDIA_STATIC_DIR: path.join(directory, 'media'),
  DISABLE_MEDIA_JOB_AUTORUN: '1',
})

const listener = createServer()
await new Promise<void>((resolve) => listener.listen(0, '127.0.0.1', resolve))
const address = listener.address()
assert(address && typeof address === 'object')
const port = address.port
await new Promise<void>((resolve) => listener.close(() => resolve()))
const base = `http://127.0.0.1:${port}`
process.env.NEXT_PUBLIC_SITE_URL = base

const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
let server: ReturnType<typeof spawn> | undefined
try {
  await payload.db.migrate()
  const build = spawnSync('pnpm', ['build'], { stdio: 'inherit', timeout: 180_000 })
  assert.equal(build.status, 0, 'Production build failed')
  const photoshoot = await payload.create({
    collection: 'projects', data: { title: 'Slug regression fixture', slug: 'original-slug' },
  })
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], { stdio: 'inherit' })
  const deadline = Date.now() + 60_000
  while (true) {
    assert(server.exitCode === null, 'Production server exited before readiness')
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(5000) })
      if (response.ok) break
    } catch { /* Wait for the production server to listen. */ }
    assert(Date.now() < deadline, 'Production server did not become ready')
    await delay(200)
  }
  const expectPage = async (slug: string, status: number) => {
    const response = await fetch(`${base}/work/${slug}`, { signal: AbortSignal.timeout(15_000) })
    const html = await response.text()
    assert.equal(response.status, status, `/work/${slug} must return ${status}`)
    assert(!html.includes('DYNAMIC_SERVER_USAGE'), `/work/${slug} hit static-to-dynamic rendering`)
    if (status === 200) assert(html.includes('<h1>Slug regression fixture</h1>'))
    console.log(`PASS /work/${slug}: ${status}`)
  }
  await expectPage('original-slug', 200)
  await payload.update({ collection: 'projects', id: photoshoot.id, data: { slug: 'renamed-after-build' } })
  await expectPage('renamed-after-build', 200)
  await expectPage('original-slug', 404)
  await expectPage('created-after-build', 404)
  await payload.create({ collection: 'projects', data: { title: 'Slug regression fixture', slug: 'created-after-build' } })
  await expectPage('created-after-build', 200)
  await expectPage('does-not-exist', 404)
} finally {
  if (server && server.exitCode === null) {
    const exited = new Promise<void>((resolve) => server!.once('exit', () => resolve()))
    server.kill('SIGTERM')
    await exited
  }
  await payload.destroy()
  await rm(directory, { recursive: true, force: true })
}
