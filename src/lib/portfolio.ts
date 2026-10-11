export type PhotoshootLike = {
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

export const fallbackSite: SiteLike = {
  name: 'CARLA GORECKA',
  roles: 'MODEL / PILATES / CREATIVE',
  heroEyebrow: 'HONEST\nNATURAL\nAUTHENTIC\nIN MOTION',
  heroHeadline: 'A CREATIVE APPROACH TO MODELING',
  handwrittenLine: 'Movement · People · Stories',
  intro: 'Fashion, movement and natural portraiture — with a body-aware point of view.',
  instagram: 'https://www.instagram.com/carlagorecka/',
  seoDescription: 'Portfolio of Carla Gorecka — model, classical Pilates teacher and creative.',
  locations: [{ label: 'WARSAW' }, { label: 'WORLDWIDE' }],
  profileFacts: [
    { label: 'Model', value: '@vanillamodels.pl' },
    { label: 'Pilates', value: 'Classical teacher' },
  ],
}

const safeObject = <T>(value: unknown): T | null =>
  value && typeof value === 'object' ? (value as T) : null

export function mediaUrl(media: MediaLike | string | number | null | undefined) {
  return safeObject<MediaLike>(media)?.url || null
}

export function mediaAlt(media: MediaLike | string | number | null | undefined, fallback: string) {
  return safeObject<MediaLike>(media)?.alt || fallback
}

export function photoshootOf(media: MediaLike) {
  return safeObject<PhotoshootLike>(media.photoshoot)
}

async function getPayloadClient() {
  const [{ default: configPromise }, { getPayload }] = await Promise.all([
    import('@payload-config'),
    import('payload'),
  ])

  return getPayload({ config: configPromise })
}

export async function getPhotoshootBySlug(slug: string): Promise<PhotoshootLike | null> {
  try {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'projects',
      where: { slug: { equals: slug } },
      depth: 0,
      limit: 1,
    })

    return (result.docs[0] as unknown as PhotoshootLike) || null
  } catch {
    return null
  }
}

export async function getPhotoshootMedia(
  photoshootId: string | number,
): Promise<MediaLike[]> {
  try {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'media',
      where: { photoshoot: { equals: photoshootId } },
      depth: 0,
      limit: 500,
      sort: 'filename',
    })

    return result.docs as unknown as MediaLike[]
  } catch {
    return []
  }
}

export async function getPortfolioData() {
  try {
    const payload = await getPayloadClient()
    const [site, photoshootResult, featuredResult] = await Promise.all([
      payload.findGlobal({ slug: 'site-settings', depth: 1 }),
      payload.find({ collection: 'projects', depth: 0, limit: 100, sort: 'order' }),
      payload.find({
        collection: 'media',
        where: { featured: { equals: true } },
        depth: 1,
        limit: 500,
        sort: 'filename',
      }),
    ])

    return {
      site: { ...fallbackSite, ...(site as unknown as SiteLike) },
      photoshoots: photoshootResult.docs as unknown as PhotoshootLike[],
      featuredMedia: featuredResult.docs as unknown as MediaLike[],
    }
  } catch {
    return {
      site: fallbackSite,
      photoshoots: [] as PhotoshootLike[],
      featuredMedia: [] as MediaLike[],
    }
  }
}
