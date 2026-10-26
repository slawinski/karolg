import path from 'node:path'
import { loadEnvFile } from 'node:process'
import { mkdtemp, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { getPayload, type Where } from 'payload'
import { MEDIA_STATIC_DIR, resolveContainedMediaPath } from '../src/lib/media-processing/paths'

for (const file of ['.env', '.env.local']) {
  try { loadEnvFile(path.resolve(file)) } catch { /* Optional local configuration. */ }
}
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:')) {
  throw new Error('This backfill is for the local SQLite database only.')
}
process.env.DISABLE_MEDIA_JOB_AUTORUN = '1'

const apply = process.argv.includes('--apply')
const legacy: Where = {
  and: [
    { kind: { equals: 'image' } },
    { or: [{ processingRevision: { less_than_equal: 0 } }, { processingRevision: { exists: false } }] },
  ],
}
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
try {
  const result = await payload.find({ collection: 'media', where: legacy, pagination: false, depth: 0, overrideAccess: true })
  const originals = await Promise.all(result.docs.map(async (media) => {
    if (!media.filename) throw new Error(`Image ${media.id} has no original filename.`)
    const file = resolveContainedMediaPath(media.filename, MEDIA_STATIC_DIR)
    const info = await stat(file)
    if (!info.isFile() || !info.size) throw new Error(`Image ${media.id} has no usable original file.`)
    return { id: media.id, filename: media.filename, revision: media.processingRevision ?? null, updatedAt: media.updatedAt, size: info.size, mtimeMs: info.mtimeMs }
  }))
  console.log(`${apply ? 'Backfill' : 'Dry run'}: ${originals.length} legacy image revision(s).`)
  if (apply && originals.length) {
    const directory = await mkdtemp(path.join(tmpdir(), 'image-revisions-'))
    const backup = path.join(directory, 'before.json')
    await writeFile(backup, JSON.stringify(originals, null, 2), { mode: 0o600 })
    console.log(`Previous metadata: ${backup}`)
    for (const original of originals) {
      const updated = await payload.db.updateOne({
        collection: 'media',
        where: { and: [{ id: { equals: original.id } }, legacy] },
        data: { processingRevision: 1, updatedAt: new Date().toISOString() },
        returning: true,
      })
      if (!updated) throw new Error(`Image ${original.id} changed during the backfill; stopped.`)
      const info = await stat(resolveContainedMediaPath(original.filename, MEDIA_STATIC_DIR))
      if (info.size !== original.size || info.mtimeMs !== original.mtimeMs) {
        throw new Error(`Original image ${original.id} changed unexpectedly; stopped.`)
      }
    }
    console.log(`Initialized ${originals.length} revisions; original files unchanged.`)
  } else if (!apply) {
    console.log('No records changed. Add --apply to initialize revisions.')
  }
} finally {
  await payload.destroy()
}
process.exit(0)
