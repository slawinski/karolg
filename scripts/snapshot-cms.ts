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
  const [site, projectsResult, mediaResult] = await Promise.all([
    payload.findGlobal({ slug: 'site-settings', depth: 1 }),
    payload.find({ collection: 'projects', depth: 1, limit: 100, sort: 'order' }),
    payload.find({ collection: 'media', depth: 0, limit: 500, sort: 'filename' }),
  ])

  const mediaDocs = mediaResult.docs as unknown as AnyDoc[]
  const mediaById = new Map(mediaDocs.map((doc) => [String(doc.id), doc]))

  const normalizeMedia = (value: unknown) => {
    const doc =
      value && typeof value === 'object'
        ? (value as AnyDoc)
        : mediaById.get(String(value))

    if (!doc) return null

    const filename = typeof doc.filename === 'string' ? doc.filename : null

    return {
      id: doc.id as string | number | undefined,
      url: filename ? `/media/${filename}` : null,
      alt: typeof doc.alt === 'string' ? doc.alt : null,
      caption: typeof doc.caption === 'string' ? doc.caption : null,
      filename,
      width: typeof doc.width === 'number' ? doc.width : null,
      height: typeof doc.height === 'number' ? doc.height : null,
    }
  }

  const normalizedMedia = mediaDocs
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

  const projects = (projectsResult.docs as unknown as AnyDoc[]).map((project) => ({
    id: project.id,
    title: project.title,
    slug: project.slug,
    category: project.category,
    excerpt: project.excerpt,
    cover: normalizeMedia(project.cover),
    gallery: Array.isArray(project.gallery)
      ? project.gallery.map(normalizeMedia).filter(Boolean)
      : [],
    featured: project.featured,
    year: project.year,
    order: project.order,
  }))

  const snapshot = {
    site: siteSnapshot,
    projects,
    media: normalizedMedia,
  }

  const source = `export type MediaLike = {
  id?: string | number
  url?: string | null
  alt?: string | null
  caption?: string | null
  filename?: string | null
  width?: number | null
  height?: number | null
}

export type ProjectLike = {
  id?: string | number
  title: string
  slug: string
  category: string
  excerpt?: string | null
  cover?: MediaLike | string | number | null
  gallery?: Array<MediaLike | string | number> | null
  featured?: boolean | null
  year?: string | null
  order?: number | null
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

const snapshot: { site: SiteLike; projects: ProjectLike[]; media: MediaLike[] } = ${JSON.stringify(snapshot, null, 2)}

export function mediaUrl(media: MediaLike | string | number | null | undefined) {
  return media && typeof media === 'object' ? media.url || null : null
}

export function mediaAlt(media: MediaLike | string | number | null | undefined, fallback: string) {
  return media && typeof media === 'object' ? media.alt || fallback : fallback
}

export async function getProjectBySlug(slug: string): Promise<ProjectLike | null> {
  return snapshot.projects.find((project) => project.slug === slug) || null
}

export async function getPortfolioData() {
  return snapshot
}
`

  await writeFile(path.resolve(outputFile), source, 'utf8')
  await writeFile(path.resolve(metaFile), JSON.stringify({ projects: projects.length, media: normalizedMedia.length }), 'utf8')
  payload.logger.info(
    `Static snapshot: media=${normalizedMedia.length}, projects=${projects.length}`,
  )
} finally {
  if (typeof payload.destroy === 'function') {
    await payload.destroy()
  }
}
