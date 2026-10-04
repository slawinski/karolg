import configPromise from '@payload-config'
import { getPayload } from 'payload'

export type MediaLike = {
  url?: string | null
  alt?: string | null
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

export const fallbackSite: Required<
  Pick<
    SiteLike,
    'name' | 'roles' | 'heroEyebrow' | 'heroHeadline' | 'handwrittenLine' | 'intro' | 'instagram' | 'seoDescription'
  >
> &
  SiteLike = {
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

export const fallbackProjects: ProjectLike[] = [
  {
    title: 'Editorials',
    slug: 'editorials',
    category: 'editorial',
    excerpt: 'Graphic portraits, studio light and character-led fashion frames.',
    cover: null,
    order: 1,
  },
  {
    title: 'Movement',
    slug: 'movement',
    category: 'movement',
    excerpt: 'Classical Pilates, line, control and motion translated into image.',
    cover: null,
    featured: true,
    order: 2,
  },
  {
    title: 'Personal',
    slug: 'personal',
    category: 'personal',
    excerpt: 'Unpolished, playful and close — the person between assignments.',
    cover: null,
    order: 3,
  },
  {
    title: 'Portraits',
    slug: 'portraits',
    category: 'portrait',
    excerpt: 'Natural portraits with a direct, modern casting-book feel.',
    cover: null,
    order: 4,
  },
]

const safeObject = <T>(value: unknown): T | null =>
  value && typeof value === 'object' ? (value as T) : null

export function mediaUrl(media: MediaLike | string | number | null | undefined) {
  const object = safeObject<MediaLike>(media)
  return object?.url || null
}

export function mediaAlt(media: MediaLike | string | number | null | undefined, fallback: string) {
  const object = safeObject<MediaLike>(media)
  return object?.alt || fallback
}

export async function getPortfolioData() {
  try {
    const payload = await getPayload({ config: configPromise })
    const [site, projectResult] = await Promise.all([
      payload.findGlobal({ slug: 'site-settings', depth: 1 }),
      payload.find({ collection: 'projects', depth: 1, limit: 20, sort: 'order' }),
    ])

    const projects = (projectResult.docs as unknown as ProjectLike[]).length
      ? (projectResult.docs as unknown as ProjectLike[])
      : fallbackProjects

    return {
      site: { ...fallbackSite, ...(site as unknown as SiteLike) },
      projects,
    }
  } catch {
    return { site: fallbackSite, projects: fallbackProjects }
  }
}
