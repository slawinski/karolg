import { cache } from 'react'
import {
  isUsableMedia,
  mediaPresentationUrl,
  normalizeMediaLike,
  normalizePhotoshootReference,
  type MediaLike,
  type PhotoshootReference,
} from './media'
import { loadAllDocuments } from './payload-pagination'

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
  socialImage?: MediaLike | string | number | null
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
  return mediaPresentationUrl(safeObject<MediaLike>(media))
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

const projectSelect = { title: true, slug: true, excerpt: true, year: true, order: true, photographers: true } as const
const publicPopulate = {
  projects: projectSelect,
  photographers: { displayName: true },
} as const
const mediaSelect = {
  url: true, alt: true, caption: true, transitionColor: true, filename: true,
  mimeType: true, width: true, height: true, photoshoot: true, kind: true,
  processingStatus: true, processingRevision: true, videoWidth: true, videoHeight: true,
  playbackFilename: true, playbackUrl: true, posterFilename: true, posterUrl: true,
  posterWidth: true, posterHeight: true,
} as const

export const getPhotoshootBySlug = cache(async (slug: string): Promise<PhotoshootLike | null> => {
  try {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'projects',
      where: { slug: { equals: slug } },
      depth: 1,
      limit: 1,
      select: projectSelect,
      populate: publicPopulate,
    })

    const photoshoot = normalizePhotoshootReference(result.docs[0])
    return photoshoot && typeof photoshoot === 'object' ? photoshoot : null
  } catch (error) {
    console.error(`Could not load photoshoot slug ${JSON.stringify(slug)}`, error)
    throw error
  }
})

export const getSiteSettings = cache(async (): Promise<SiteLike> => {
  const payload = await getPayloadClient()
  const site = await payload.findGlobal({ slug: 'site-settings', depth: 1, overrideAccess: false,
    select: { name: true, roles: true, heroEyebrow: true, heroHeadline: true,
      handwrittenLine: true, intro: true, locations: true, profileFacts: true,
      instagram: true, email: true, seoDescription: true, socialImage: true },
    populate: { media: { url: true, filename: true, alt: true, mimeType: true, kind: true,
      processingRevision: true, width: true, height: true } },
  })
  return { ...fallbackSite, ...(site as unknown as SiteLike), socialImage: normalizeMediaLike(site.socialImage) }
})

export async function getPhotoshoots(): Promise<PhotoshootLike[]> {
  const payload = await getPayloadClient()
  const docs = await loadAllDocuments((pagination) => payload.find({
    collection: 'projects', depth: 1, ...pagination, sort: 'order',
    select: projectSelect, populate: publicPopulate,
  }))
  return docs.map(normalizePhotoshootReference).filter((doc): doc is PhotoshootLike =>
    Boolean(doc) && typeof doc === 'object')
}

export async function getPhotoshootMedia(
  photoshootId: string | number,
): Promise<MediaLike[]> {
  try {
    const payload = await getPayloadClient()
    const docs = await loadAllDocuments((pagination) => payload.find({
      collection: 'media',
      where: { photoshoot: { equals: photoshootId } },
      depth: 2,
      ...pagination,
      sort: 'filename',
      overrideAccess: false,
      select: mediaSelect,
      populate: publicPopulate,
    }))

    return docs
      .map((doc) => normalizeMediaLike(doc))
      .filter((doc): doc is MediaLike => Boolean(doc) && isUsableMedia(doc))
  } catch (error) {
    console.error(`Could not load media for photoshoot ${String(photoshootId)}`, error)
    throw error
  }
}

export async function getPortfolioData() {
  try {
    const payload = await getPayloadClient()
    const [site, photoshoots, media] = await Promise.all([
      payload.findGlobal({ slug: 'site-settings', depth: 2,
        select: { name: true, roles: true, heroEyebrow: true, heroHeadline: true,
          handwrittenLine: true, intro: true, heroMedia: true, locations: true,
          profileFacts: true, instagram: true, email: true, seoDescription: true },
        populate: { ...publicPopulate, media: mediaSelect },
      }),
      loadAllDocuments((pagination) => payload.find({
        collection: 'projects',
        depth: 1,
        ...pagination,
        sort: 'order',
        select: projectSelect,
        populate: publicPopulate,
      })),
      loadAllDocuments((pagination) => payload.find({
        collection: 'media',
        depth: 2,
        ...pagination,
        sort: 'filename',
        overrideAccess: false,
        select: mediaSelect,
        populate: publicPopulate,
      })),
    ])

    return {
      site: {
        ...fallbackSite,
        ...(site as unknown as SiteLike),
        heroMedia: site.heroMedia && typeof site.heroMedia === 'object'
          ? normalizeMediaLike(site.heroMedia)
          : site.heroMedia,
      },
      photoshoots: photoshoots
        .map((photoshoot) => normalizePhotoshootReference(photoshoot))
        .filter((photoshoot): photoshoot is PhotoshootLike =>
          Boolean(photoshoot) && typeof photoshoot === 'object'),
      media: media
        .map((doc) => normalizeMediaLike(doc))
        .filter((doc): doc is MediaLike => Boolean(doc)),
    }
  } catch (error) {
    console.error('Could not load portfolio data', error)
    throw error
  }
}
