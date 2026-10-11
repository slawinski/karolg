import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { loadEnvFile } from 'node:process'
import { getPayload } from 'payload'

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

const { default: config } = await import('../src/payload.config')

const outputFile = process.argv[2]
const metaFile = process.argv[3]

if (!outputFile || !metaFile) {
  throw new Error('Usage: tsx scripts/snapshot-cms.ts <output-file> <meta-file>')
}

type AnyDoc = Record<string, unknown>

const payload = await getPayload({ config })

try {
  const [site, photoshootsResult, mediaResult] = await Promise.all([
    payload.findGlobal({ slug: 'site-settings', depth: 1 }),
    payload.find({ collection: 'projects', depth: 0, limit: 100, sort: 'order' }),
    payload.find({ collection: 'media', depth: 1, limit: 500, sort: 'filename' }),
  ])

  const photoshootDocs = photoshootsResult.docs as unknown as AnyDoc[]
  const photoshootsById = new Map(photoshootDocs.map((doc) => [String(doc.id), doc]))

  const normalizePhotoshoot = (value: unknown) => {
    const doc =
      value && typeof value === 'object'
        ? (value as AnyDoc)
        : photoshootsById.get(String(value))

    if (!doc) return null

    return {
      id: doc.id as string | number | undefined,
      title: typeof doc.title === 'string' ? doc.title : '',
      slug: typeof doc.slug === 'string' ? doc.slug : '',
      excerpt: typeof doc.excerpt === 'string' ? doc.excerpt : null,
      year: typeof doc.year === 'string' ? doc.year : null,
      order: typeof doc.order === 'number' ? doc.order : null,
    }
  }

  const normalizeMedia = (value: unknown) => {
    if (!value || typeof value !== 'object') return null
    const doc = value as AnyDoc
    const filename = typeof doc.filename === 'string' ? doc.filename : null

    return {
      id: doc.id as string | number | undefined,
      url: filename ? `/media/${filename}` : null,
      alt: typeof doc.alt === 'string' ? doc.alt : null,
      caption: typeof doc.caption === 'string' ? doc.caption : null,
      filename,
      width: typeof doc.width === 'number' ? doc.width : null,
      height: typeof doc.height === 'number' ? doc.height : null,
      featured: doc.featured === true,
      photoshoot: normalizePhotoshoot(doc.photoshoot),
    }
  }

  const photoshoots = photoshootDocs
    .map(normalizePhotoshoot)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  const media = (mediaResult.docs as unknown as AnyDoc[])
    .map(normalizeMedia)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  const siteDoc = site as unknown as AnyDoc
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
          const row = item as AnyDoc
          return { label: typeof row.label === 'string' ? row.label : null }
        })
      : [],
    profileFacts: Array.isArray(siteDoc.profileFacts)
      ? siteDoc.profileFacts.map((item) => {
          const row = item as AnyDoc
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

  const source = `export type PhotoshootLike = {
  id?: string | number
  title: string
  slug: string
  excerpt?: string | null
  year?: string | null
  order?: number | null
}

export type MediaLike = {
  id?: string | number
  url?: string | null
  alt?: string | null
  caption?: string | null
  filename?: string | null
  width?: number | null
  height?: number | null
  featured?: boolean | null
  photoshoot?: PhotoshootLike | string | number | null
}

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
  return media && typeof media === 'object' ? media.url || null : null
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
    return photoshoot && String(photoshoot.id) === String(photoshootId)
  })
}

export async function getPortfolioData() {
  return {
    site: snapshot.site,
    photoshoots: snapshot.photoshoots,
    featuredMedia: snapshot.media.filter((media) => media.featured && photoshootOf(media)),
  }
}
`

  await writeFile(path.resolve(outputFile), source, 'utf8')
  await writeFile(
    path.resolve(metaFile),
    JSON.stringify({ photoshoots: photoshoots.length, media: media.length }),
    'utf8',
  )

  payload.logger.info(
    `Static snapshot: media=${media.length}, photoshoots=${photoshoots.length}`,
  )
} finally {
  if (typeof payload.destroy === 'function') {
    await payload.destroy()
  }
}
