import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '@payload-config'

const SOURCE_DIR = path.resolve(process.cwd(), 'sesja-karolg')

const toAlt = (filename: string) => {
  const base = filename.replace(/\.[^.]+$/, '')
  const cleaned = base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return `Sesja Karolg — ${cleaned}`
}

const seed = async () => {
  const payload = await getPayload({ config })

  const entries = await readdir(SOURCE_DIR, { withFileTypes: true })
  const files = entries
    .filter((e) => e.isFile() && /\.jpe?g$/i.test(e.name))
    .map((e) => e.name)
    .sort()

  if (files.length === 0) {
    payload.logger.warn(`No JPEG files found in ${SOURCE_DIR}`)
    return
  }

  let created = 0
  let skipped = 0
  let failed = 0

  for (const file of files) {
    const existing = await payload.find({
      collection: 'media',
      limit: 1,
      where: { filename: { equals: file } },
    })

    if (existing.totalDocs > 0) {
      payload.logger.info(`Skipping ${file} — already in media`)
      skipped += 1
      continue
    }

    try {
      await payload.create({
        collection: 'media',
        overrideAccess: true,
        data: {
          alt: toAlt(file),
          caption: 'Sesja Karolg',
        },
        filePath: path.resolve(SOURCE_DIR, file),
      })
      payload.logger.info(`Imported ${file}`)
      created += 1
    } catch (err) {
      payload.logger.error(`Failed ${file}: ${(err as Error).message}`)
      failed += 1
    }
  }

  payload.logger.info(`Done. created=${created} skipped=${skipped} failed=${failed}`)

  if (typeof payload.destroy === 'function') {
    await payload.destroy()
  }
}

await seed()
