import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { sqliteAdapter, sql } from '@payloadcms/db-sqlite'
import { buildConfig, createLocalReq, getPayload, type Payload } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Media } from '../collections/Media'
import { Photoshoots } from '../collections/Photoshoots'
import { Photographers } from '../collections/Photographers'
import { Users } from '../collections/Users'
import { SiteSettings } from '../globals/SiteSettings'
import { migrations } from '../migrations'
import { down } from '../migrations/20261018_151842_social_image'

describe('social image migration on a populated database', () => {
  let directory: string | undefined
  let payload: Payload | undefined
  afterEach(async () => {
    vi.doUnmock('@payload-config')
    vi.doUnmock('payload')
    await payload?.destroy()
    if (directory) await rm(directory, { recursive: true, force: true })
  })

  it('preserves existing content and relationships through upgrade and rollback', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'karolg-social-migration-'))
    payload = await getPayload({ key: `social-migration-${Date.now()}`, config: buildConfig({
      secret: 'isolated-social-image-migration-fixture',
      db: sqliteAdapter({ push: false, client: { url: `file:${path.join(directory, 'fixture.db')}` } }),
      collections: [Users, Media, Photoshoots, Photographers], globals: [SiteSettings],
    }) })
    const db = payload.db.drizzle
    const req = await createLocalReq({}, payload)
    const args = { db, payload, req }
    for (const migration of migrations.slice(0, -1)) await migration.up(args)
    await db.run(sql`INSERT INTO projects (id, title, slug) VALUES (1, 'Existing shoot', 'existing-shoot')`)
    await db.run(sql`INSERT INTO photographers (id, display_name) VALUES (1, 'Existing photographer')`)
    await db.run(sql`INSERT INTO projects_rels (parent_id, path, photographers_id) VALUES (1, 'photographers', 1)`)
    await db.run(sql`INSERT INTO media (id, alt, filename, mime_type, photoshoot_id) VALUES (1, 'Existing photo', 'existing.jpg', 'image/jpeg', 1)`)
    await db.run(sql`INSERT INTO media (id, filename, mime_type, kind, processing_status) VALUES (2, 'private.mov', 'video/quicktime', 'video', 'pending')`)
    await db.run(sql`INSERT INTO media (id, filename, mime_type) VALUES (3, 'unsupported.webp', 'image/webp')`)
    await db.run(sql`INSERT INTO site_settings (id, name, hero_media_id, email) VALUES (1, 'Existing name', 1, 'existing@example.test')`)
    await db.run(sql`INSERT INTO site_settings_locations (_order, _parent_id, id, label) VALUES (1, 1, 'location-1', 'Existing location')`)
    await db.run(sql`INSERT INTO site_settings_profile_facts (_order, _parent_id, id, label, value) VALUES (1, 1, 'fact-1', 'Existing label', 'Existing value')`)
    const tables = ['projects', 'photographers', 'projects_rels', 'media', 'site_settings', 'site_settings_locations', 'site_settings_profile_facts']
    const snapshot = () => Promise.all(tables.map(async (table) =>
      (await db.all<Record<string, unknown>>(sql.raw(`SELECT * FROM "${table}" ORDER BY id`)))
        .map(({ social_image_id: _social, ...row }) => row)))
    const before = await snapshot()
    await migrations[migrations.length - 1].up(args)
    expect(await snapshot()).toEqual(before)
    expect((await payload.findGlobal({ slug: 'site-settings' })).socialImage).toBeNull()
    const selected = await payload.updateGlobal({ slug: 'site-settings', data: { socialImage: 1 }, depth: 0 })
    expect(selected.socialImage).toBe(1)
    expect(selected.name).toBe('Existing name')
    vi.doMock('@payload-config', () => ({ default: Promise.resolve({}) }))
    vi.doMock('payload', () => ({ getPayload: async () => payload }))
    const { getSiteSettings } = await import('./portfolio')
    expect((await getSiteSettings()).socialImage).toMatchObject({ url: '/api/media/file/existing.jpg' })
    await expect(payload.updateGlobal({ slug: 'site-settings', data: { socialImage: 2 } })).rejects.toThrow()
    await expect(payload.updateGlobal({ slug: 'site-settings', data: { socialImage: 3 } })).rejects.toThrow()
    expect(await db.all(sql`PRAGMA foreign_key_list(site_settings)`)).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'social_image_id', on_delete: 'SET NULL' }),
    ]))
    const beforeRollback = await snapshot()
    await down(args)
    expect(await snapshot()).toEqual(beforeRollback)
    expect(await db.all(sql`PRAGMA foreign_key_check`)).toEqual([])
  }, 30_000)
})
