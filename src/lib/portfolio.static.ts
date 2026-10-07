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

export const placeholderMedia: MediaLike[] = [
  {
    url: '/placeholders/instagram-01.webp',
    alt: 'Carla Gorecka in a Pilates movement pose — temporary screenshot crop',
    width: 320,
    height: 320,
  },
  {
    url: '/placeholders/instagram-02.webp',
    alt: 'Carla Gorecka seated in black — temporary screenshot crop',
    width: 320,
    height: 320,
  },
  {
    url: '/placeholders/instagram-04.webp',
    alt: 'Black and white fashion portrait of Carla Gorecka — temporary screenshot crop',
    width: 320,
    height: 320,
  },
  {
    url: '/placeholders/instagram-05.webp',
    alt: 'Playful close portrait of Carla Gorecka — temporary screenshot crop',
    width: 320,
    height: 320,
  },
  {
    url: '/placeholders/instagram-06.webp',
    alt: 'Carla Gorecka in a brown top and denim — temporary screenshot crop',
    width: 320,
    height: 320,
  },
]

const rotatePlaceholders = (offset: number) =>
  Array.from({ length: placeholderMedia.length }, (_, index) =>
    placeholderMedia[(index + offset) % placeholderMedia.length],
  )

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
  heroMedia: placeholderMedia[1],
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
    cover: placeholderMedia[2],
    gallery: rotatePlaceholders(2),
    order: 1,
  },
  {
    title: 'Movement',
    slug: 'movement',
    category: 'movement',
    excerpt: 'Classical Pilates, line, control and motion translated into image.',
    cover: placeholderMedia[0],
    gallery: rotatePlaceholders(0),
    featured: true,
    order: 2,
  },
  {
    title: 'Personal',
    slug: 'personal',
    category: 'personal',
    excerpt: 'Unpolished, playful and close — the person between assignments.',
    cover: placeholderMedia[3],
    gallery: rotatePlaceholders(3),
    order: 3,
  },
  {
    title: 'Portraits',
    slug: 'portraits',
    category: 'portrait',
    excerpt: 'Natural portraits with a direct, modern casting-book feel.',
    cover: placeholderMedia[4],
    gallery: rotatePlaceholders(4),
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

export async function getProjectBySlug(slug: string): Promise<ProjectLike | null> {
  return fallbackProjects.find((project) => project.slug === slug) || null
}

export async function getPortfolioData() {
  return { site: fallbackSite, projects: fallbackProjects }
}
