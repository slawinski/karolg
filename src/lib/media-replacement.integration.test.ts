import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { buildConfig, getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mediaPresentationUrl, normalizeMediaLike } from './media'

const publicURL = (doc: unknown) => mediaPresentationUrl(normalizeMediaLike(doc))

describe('real Payload image replacement', () => {
  let directory: string | undefined
  let payload: Payload | undefined

  afterEach(async () => {
    await payload?.destroy()
    if (directory) await rm(directory, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('advances same-record same-basename identity only for uploads', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'karolg-image-replacement-'))
    vi.stubEnv('MEDIA_STATIC_DIR', path.join(directory, 'media'))
    const { Media } = await import('../collections/Media')
    payload = await getPayload({ key: `replacement-${Date.now()}`, config: buildConfig({
      secret: 'isolated-image-replacement-fixture-secret',
      db: sqliteAdapter({ client: { url: `file:${path.join(directory, 'fixture.db')}` } }),
      sharp,
      collections: [Media, { slug: 'projects', fields: [{ name: 'title', type: 'text' }] }],
    }) })
    const file = async (background: string) => {
      const data = await sharp({ create: { width: 32, height: 32, channels: 3, background } }).jpeg().toBuffer()
      return { data, name: 'portrait.jpg', mimetype: 'image/jpeg', size: data.length }
    }
    const first = await payload.create({ collection: 'media', data: { alt: 'First', kind: 'image', processingStatus: 'ready', processingRevision: 0 }, file: await file('red'), overrideAccess: true })
    const replaced = await payload.update({ collection: 'media', id: first.id, data: {}, file: await file('blue'), overwriteExistingFiles: true, overrideAccess: true })
    expect(replaced.id).toBe(first.id)
    expect(replaced.filename).toBe(first.filename)
    expect(first.processingRevision).toBe(1)
    expect(replaced.processingRevision).toBe(2)
    expect(publicURL(first)).toBe(`${first.url}?v=1`)
    expect(publicURL(replaced)).toBe(`${replaced.url}?v=2`)
    const metadata = await payload.update({ collection: 'media', id: first.id, data: { alt: 'Metadata only' }, overrideAccess: true })
    const color = await payload.update({ collection: 'media', id: first.id, data: { transitionColor: '#123456' }, context: { mediaProcessing: true }, overrideAccess: true })
    expect(publicURL(metadata)).toBe(publicURL(replaced))
    expect(publicURL(color)).toBe(publicURL(replaced))
  }, 30_000)
})
