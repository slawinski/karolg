import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { buildConfig, getPayload, type CollectionConfig, type Payload } from 'payload'
import { afterEach, describe, expect, it } from 'vitest'
import { compareAndSwapVideoRevision } from './service'

const MediaForCASTest: CollectionConfig = {
  slug: 'media',
  fields: [
    { name: 'alt', type: 'text', required: true },
    { name: 'kind', type: 'select', options: ['image', 'video'], required: true },
    { name: 'processingRevision', type: 'number', required: true },
    {
      name: 'processingStatus',
      type: 'select',
      options: ['pending', 'processing', 'ready', 'failed'],
      required: true,
    },
    { name: 'processingError', type: 'text' },
    { name: 'playbackFilename', type: 'text' },
    { name: 'posterFilename', type: 'text' },
  ],
}

describe('SQLite conditional media updates', () => {
  const payloads: Payload[] = []
  let directory: string | undefined

  afterEach(async () => {
    await Promise.all(payloads.splice(0).map((payload) => payload.destroy()))
    if (directory) await rm(directory, { recursive: true, force: true })
    directory = undefined
  })

  it('allows one revision claim and prevents stale publication', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'karolg-cas-'))
    const databaseURL = `file:${path.join(directory, 'cas.db')}`
    const config = () => buildConfig({
      secret: '8f93d15cbb7a45c9a4f608b09fd19764',
      db: sqliteAdapter({
        client: { url: databaseURL },
        busyTimeout: 5_000,
        wal: true,
      }),
      collections: [MediaForCASTest],
    })
    const first = await getPayload({ config: config(), key: `cas-a-${Date.now()}` })
    payloads.push(first)
    const media = await first.create({
      collection: 'media',
      data: {
        alt: 'CAS fixture',
        kind: 'video',
        processingRevision: 1,
        processingStatus: 'pending',
      },
      overrideAccess: true,
    })
    const second = await getPayload({ config: config(), key: `cas-b-${Date.now()}` })
    payloads.push(second)

    const claims = await Promise.all([
      compareAndSwapVideoRevision(first, media.id, 1, {
        processingStatus: 'processing',
        processingError: 'first',
      }, { statuses: ['pending'] }),
      compareAndSwapVideoRevision(second, media.id, 1, {
        processingStatus: 'processing',
        processingError: 'second',
      }, { statuses: ['pending'] }),
    ])
    expect(claims.filter(Boolean)).toHaveLength(1)

    const advanced = await compareAndSwapVideoRevision(first, media.id, 1, {
      processingRevision: 2,
      processingStatus: 'pending',
      processingError: null,
    }, { statuses: ['processing'] })
    expect(advanced?.processingRevision).toBe(2)

    const stalePublish = await compareAndSwapVideoRevision(second, media.id, 1, {
      processingStatus: 'ready',
      playbackFilename: `generated/${media.id}/r1/playback.mp4`,
      posterFilename: `generated/${media.id}/r1/poster.jpg`,
    }, { statuses: ['processing'] })
    expect(stalePublish).toBeUndefined()

    await expect(first.findByID({
      collection: 'media',
      id: media.id,
      overrideAccess: true,
    })).resolves.toMatchObject({
      processingRevision: 2,
      processingStatus: 'pending',
      playbackFilename: null,
      posterFilename: null,
    })
  }, 30_000)
})
