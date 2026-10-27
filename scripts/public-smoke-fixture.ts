import assert from 'node:assert/strict'
import { execFileSync, type ChildProcess } from 'node:child_process'
import { lstatSync } from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'

// Next loads these even when the smoke supplies its own database and secret.
export function assertSmokeCheckout(root: string) {
  for (const name of ['.env.production.local', '.env.local', '.env.production', '.env']) {
    try {
      lstatSync(path.join(root, name))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw error
    }
    throw new Error(`Public smoke refuses ${name}; use a clean checkout without production .env files`)
  }
}

export function waitForSmokeChild(child: ChildProcess, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer)
      child.off('error', onError)
      child.off('exit', onExit)
      if (error) reject(error)
      else resolve()
    }
    const onError = (error: Error) => finish(error)
    const onExit = (code: number | null, signal: NodeJS.Signals | null) =>
      finish(code === 0 ? undefined : new Error(`Command failed: exit ${code}, signal ${signal}`))
    const timer = setTimeout(() => finish(new Error(`Command timed out after ${timeout}ms`)), timeout)
    child.once('error', onError)
    child.once('exit', onExit)
  })
}

export async function stopSmokeChild(child: ChildProcess) {
  const pid = child.pid
  // Callers spawn detached: this PID owns the group, even after its leader exits.
  if (!pid || !Number.isInteger(pid) || pid <= 1) return
  const signal = (name: NodeJS.Signals | 0) => {
    try { process.kill(-pid, name); return true } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
      return false
    }
  }
  const leaderExited = () => child.exitCode !== null || child.signalCode !== null
  const drained = async () => {
    const deadline = Date.now() + 5000
    do {
      if (!signal(0) && leaderExited()) return true
      await new Promise((resolve) => setTimeout(resolve, 50))
    } while (Date.now() < deadline)
    return !signal(0) && leaderExited()
  }
  signal('SIGTERM')
  if (await drained()) return
  signal('SIGKILL')
  if (await drained()) return
  // kill(0) also sees orphaned zombies, which only init can reap (not us).
  // After the bounded wait, distinguish these from surviving runnable workers.
  const rows = execFileSync('ps', ['-axo', 'pgid=,stat='], { encoding: 'utf8', timeout: 1000 })
  const survivors = rows.split('\n').some((row) => {
    const [group, state] = row.trim().split(/\s+/)
    return Number(group) === pid && !state.startsWith('Z')
  })
  assert(leaderExited() && !survivors, 'Owned smoke process group did not exit after SIGKILL')
}

export type PublicSmokeFixture = {
  story: { id: number; slug: string; title: string }
  email: string
  images: Array<{ id: number; url: string; cardUrl: string; heroUrl: string }>
  video: { id: number; revision: number; posterUrl: string; playbackUrl: string }
}

// Imports that can initialize Payload/media paths stay behind the caller's env setup.
export async function seedPublicSmokeFixture(payload: Payload, videoPath: string): Promise<PublicSmokeFixture> {
  const [{ default: sharp }, { runVideoProcessing }] = await Promise.all([
    import('sharp'), import('../src/lib/media-processing/service'),
  ])
  const story = await payload.create({
    collection: 'projects',
    data: { title: 'Public smoke portrait story', slug: 'public-smoke-story', order: 0 },
  })
  assert(story.slug)
  const images: PublicSmokeFixture['images'] = []
  for (const [index, background] of ['#9d6758', '#607b80', '#b3a484'].entries()) {
    const data = await sharp({ create: { width: 1800, height: 2400, channels: 3, background } }).jpeg().toBuffer()
    const media = await payload.create({
      collection: 'media',
      data: { alt: `Smoke portrait ${index + 1}`, photoshoot: story.id,
        kind: 'image', processingStatus: 'ready', processingRevision: 0 },
      file: { name: `smoke-portrait-${index + 1}.jpg`, data, mimetype: 'image/jpeg', size: data.length },
    })
    assert(media.url && media.sizes?.card?.url && media.sizes?.hero?.url, 'Fixture image sizes must be published')
    images.push({ id: media.id, url: media.url, cardUrl: media.sizes.card.url, heroUrl: media.sizes.hero.url })
  }
  const uploaded = await payload.create({
    collection: 'media', data: { alt: 'Smoke motion portrait', photoshoot: story.id,
      kind: 'video', processingStatus: 'pending', processingRevision: 0 }, filePath: videoPath,
  })
  const revision = uploaded.processingRevision
  assert.equal(await runVideoProcessing(payload, uploaded.id, revision), 'ready')
  const video = await payload.findByID({ collection: 'media', id: uploaded.id, depth: 0, overrideAccess: false })
  assert.equal(video.processingStatus, 'ready')
  assert(video.posterFilename && video.playbackFilename && video.posterUrl && video.playbackUrl,
    'Fixture video must have published poster and playback derivatives')
  const email = 'public-smoke@example.invalid'
  await payload.updateGlobal({ slug: 'site-settings', data: { email, heroMedia: images[0].id, instagram: '' } })
  return {
    story: { id: story.id, slug: story.slug, title: story.title }, email, images,
    video: { id: video.id, revision, posterUrl: video.posterUrl, playbackUrl: video.playbackUrl },
  }
}
