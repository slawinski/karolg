import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { loadEnvFile } from 'node:process'
import { getPayload } from 'payload'
import {
  documentsById,
  normalizeSnapshotMedia,
  normalizeSnapshotPhotoshoot,
  type SnapshotDocument,
} from '../src/lib/snapshot'
import { loadAllDocuments } from '../src/lib/payload-pagination'

const root = process.cwd()

for (const envFile of ['.env', '.env.local']) {
  try {
    loadEnvFile(path.join(root, envFile))
  } catch {
    // Optional local env file.
  }
}

const dbUrl = process.env.DATABASE_URL || 'file:./data/karolg.db'
if (dbUrl.startsWith('file:./')) {
  await mkdir(path.dirname(path.resolve(root, dbUrl.slice('file:./'.length))), { recursive: true })
}

process.env.DISABLE_MEDIA_JOB_AUTORUN = '1'
const { default: config } = await import('../src/payload.config')

const outputFile = process.argv[2]
const metaFile = process.argv[3]

if (!outputFile || !metaFile) {
  throw new Error('Usage: tsx scripts/snapshot-cms.ts <output-file> <meta-file>')
}

const payload = await getPayload({ config })

try {
  const [site, photoshootDocs, photographerDocs, mediaDocs] = await Promise.all([
    payload.findGlobal({ slug: 'site-settings', depth: 2 }),
    loadAllDocuments((pagination) => payload.find({
      collection: 'projects',
      depth: 0,
      ...pagination,
      sort: 'order',
    })),
    loadAllDocuments((pagination) => payload.find({
      collection: 'photographers',
      depth: 0,
      ...pagination,
      sort: 'displayName',
    })),
    loadAllDocuments((pagination) => payload.find({
      collection: 'media',
      depth: 2,
      ...pagination,
      sort: 'filename',
      overrideAccess: false,
    })),
  ])

  const snapshotPhotoshoots = photoshootDocs as unknown as SnapshotDocument[]
  const snapshotPhotographers = photographerDocs as unknown as SnapshotDocument[]
  const photoshootsById = documentsById(snapshotPhotoshoots)
  const photographersById = documentsById(snapshotPhotographers)
  const normalizePhotoshoot = (value: unknown) =>
    normalizeSnapshotPhotoshoot(value, photoshootsById, photographersById)
  const normalizeMedia = (value: unknown) =>
    normalizeSnapshotMedia(value, photoshootsById, photographersById)

  const photoshoots = snapshotPhotoshoots
    .map(normalizePhotoshoot)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  const media = (mediaDocs as unknown as SnapshotDocument[])
    .map(normalizeMedia)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  const siteDoc = site as unknown as SnapshotDocument
  const siteSnapshot = {
    name: siteDoc.name,
    roles: siteDoc.roles,
    heroEyebrow: siteDoc.heroEyebrow,
    heroHeadline: siteDoc.heroHeadline,
    handwrittenLine: siteDoc.handwrittenLine,
    intro: siteDoc.intro,
    heroMedia: normalizeMedia(siteDoc.heroMedia),
    locations: Array.isArray(siteDoc.locations)
      ? siteDoc.locations.map((item) => {
          const row = item as SnapshotDocument
          return { label: typeof row.label === 'string' ? row.label : null }
        })
      : [],
    profileFacts: Array.isArray(siteDoc.profileFacts)
      ? siteDoc.profileFacts.map((item) => {
          const row = item as SnapshotDocument
          return {
            label: typeof row.label === 'string' ? row.label : null,
            value: typeof row.value === 'string' ? row.value : null,
          }
        })
      : [],
    instagram: siteDoc.instagram,
    email: siteDoc.email,
    seoDescription: siteDoc.seoDescription,
  }

  const snapshot = {
    site: siteSnapshot,
    photoshoots,
    media,
  }

const source = `import {
  isUsableMedia,
  mediaPresentationUrl,
  type MediaLike,
  type PhotoshootReference,
} from './media'

export type PhotoshootLike = PhotoshootReference

export type { MediaLike, PhotographerLike } from './media'

export type SiteLike = {
  name?: string | null
  roles?: string | null
  heroEyebrow?: string | null
  heroHeadline?: string | null
  handwrittenLine?: string | null
  intro?: string | null
  heroMedia?: MediaLike | string | number | null
  locations?: Array<{ label?: string | null }> | null
  profileFacts?: Array<{ label?: string | null; value?: string | null }> | null
  instagram?: string | null
  email?: string | null
  seoDescription?: string | null
}

const snapshot: { site: SiteLike; photoshoots: PhotoshootLike[]; media: MediaLike[] } = ${JSON.stringify(snapshot, null, 2)}

export function mediaUrl(media: MediaLike | string | number | null | undefined) {
  return media && typeof media === 'object' ? mediaPresentationUrl(media) : null
}

export function mediaAlt(media: MediaLike | string | number | null | undefined, fallback: string) {
  return media && typeof media === 'object' ? media.alt || fallback : fallback
}

export function photoshootOf(media: MediaLike) {
  return media.photoshoot && typeof media.photoshoot === 'object' ? media.photoshoot : null
}

export async function getPhotoshootBySlug(slug: string): Promise<PhotoshootLike | null> {
  return snapshot.photoshoots.find((photoshoot) => photoshoot.slug === slug) || null
}

export async function getPhotoshootMedia(photoshootId: string | number): Promise<MediaLike[]> {
  return snapshot.media.filter((media) => {
    const photoshoot = photoshootOf(media)
    return photoshoot && String(photoshoot.id) === String(photoshootId) && isUsableMedia(media)
  })
}

export async function getPortfolioData() {
  return snapshot
}
`

  await writeFile(path.resolve(outputFile), source, 'utf8')
  await writeFile(
    path.resolve(metaFile),
    JSON.stringify({ photoshoots: photoshoots.length, media }),
    'utf8',
  )

  payload.logger.info(
    `Static snapshot: media=${media.length}, photoshoots=${photoshoots.length}`,
  )
} catch (error) {
  payload.logger.error({ err: error, msg: 'Static CMS snapshot failed' })
  throw error
} finally {
  if (typeof payload.destroy === 'function') {
    await Promise.race([
      payload.destroy(),
      new Promise<void>((resolve) => setTimeout(resolve, 1_000)),
    ])
  }
}

// Payload's jobs infrastructure can retain timers after the one-shot snapshot.
// Every required write above is awaited, so terminate the successful CLI explicitly.
process.exit(0)
