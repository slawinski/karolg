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

export const sesjaMedia: MediaLike[] = [
  { url: '/sesja/000729840002-Edit.jpg', alt: 'Sesja Karolg — 000729840002 Edit', width: 720, height: 960 },
  { url: '/sesja/000729840004-Edit.jpg', alt: 'Sesja Karolg — 000729840004 Edit', width: 720, height: 960 },
  { url: '/sesja/000729840006-Edit.jpg', alt: 'Sesja Karolg — 000729840006 Edit', width: 720, height: 960 },
  { url: '/sesja/000729840007-Edit.jpg', alt: 'Sesja Karolg — 000729840007 Edit', width: 720, height: 960 },
  { url: '/sesja/000729840008-2-Edit.jpg', alt: 'Sesja Karolg — 000729840008 2 Edit', width: 720, height: 960 },
  { url: '/sesja/000729840012-Edit.jpg', alt: 'Sesja Karolg — 000729840012 Edit', width: 720, height: 960 },
  { url: '/sesja/3N7A0290.jpg', alt: 'Sesja Karolg — 3N7A0290', width: 720, height: 960 },
  { url: '/sesja/3N7A0293.jpg', alt: 'Sesja Karolg — 3N7A0293', width: 720, height: 960 },
  { url: '/sesja/3N7A0295.jpg', alt: 'Sesja Karolg — 3N7A0295', width: 720, height: 960 },
  { url: '/sesja/3N7A0304.jpg', alt: 'Sesja Karolg — 3N7A0304', width: 720, height: 960 },
  { url: '/sesja/3N7A0352.jpg', alt: 'Sesja Karolg — 3N7A0352', width: 720, height: 960 },
  { url: '/sesja/3N7A0369.jpg', alt: 'Sesja Karolg — 3N7A0369', width: 720, height: 960 },
  { url: '/sesja/3N7A0407.jpg', alt: 'Sesja Karolg — 3N7A0407', width: 720, height: 960 },
  { url: '/sesja/3N7A0416.jpg', alt: 'Sesja Karolg — 3N7A0416', width: 720, height: 960 },
  { url: '/sesja/3N7A0433-2.jpg', alt: 'Sesja Karolg — 3N7A0433 2', width: 720, height: 960 },
  { url: '/sesja/3N7A0440.jpg', alt: 'Sesja Karolg — 3N7A0440', width: 720, height: 960 },
  { url: '/sesja/IMG_1178.jpg', alt: 'Sesja Karolg — IMG 1178', width: 720, height: 960 },
  { url: '/sesja/IMG_8825.jpg', alt: 'Sesja Karolg — IMG 8825', width: 720, height: 960 },
  { url: '/sesja/IMG_8831.jpg', alt: 'Sesja Karolg — IMG 8831', width: 720, height: 960 },
  { url: '/sesja/IMG_8852.jpg', alt: 'Sesja Karolg — IMG 8852', width: 720, height: 960 },
  { url: '/sesja/IMG_8855.jpg', alt: 'Sesja Karolg — IMG 8855', width: 720, height: 960 },
  { url: '/sesja/IMG_8862.jpg', alt: 'Sesja Karolg — IMG 8862', width: 720, height: 960 },
  { url: '/sesja/IMG_8865.jpg', alt: 'Sesja Karolg — IMG 8865', width: 720, height: 960 },
  { url: '/sesja/IMG_8867.jpg', alt: 'Sesja Karolg — IMG 8867', width: 720, height: 960 },
  { url: '/sesja/IMG_8885.jpg', alt: 'Sesja Karolg — IMG 8885', width: 720, height: 960 },
  { url: '/sesja/IMG_8949.jpg', alt: 'Sesja Karolg — IMG 8949', width: 720, height: 960 },
  { url: '/sesja/IMG_8987.jpg', alt: 'Sesja Karolg — IMG 8987', width: 720, height: 960 },
  { url: '/sesja/IMG_9104.jpg', alt: 'Sesja Karolg — IMG 9104', width: 720, height: 960 },
  { url: '/sesja/IMG_9109.jpg', alt: 'Sesja Karolg — IMG 9109', width: 720, height: 960 },
  { url: '/sesja/IMG_9167.jpg', alt: 'Sesja Karolg — IMG 9167', width: 720, height: 960 },
  { url: '/sesja/IMG_9304.jpg', alt: 'Sesja Karolg — IMG 9304', width: 720, height: 960 },
  { url: '/sesja/IMG_9309.jpg', alt: 'Sesja Karolg — IMG 9309', width: 720, height: 960 },
  { url: '/sesja/IMG_9331.jpg', alt: 'Sesja Karolg — IMG 9331', width: 720, height: 960 },
  { url: '/sesja/IMG_9354.jpg', alt: 'Sesja Karolg — IMG 9354', width: 720, height: 960 },
]

const sesjaHero = sesjaMedia[3]
const sesjaGallery = [...sesjaMedia.slice(0, 3), ...sesjaMedia.slice(4)]

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
  heroMedia: sesjaHero,
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
    title: 'Sesja Karolg',
    slug: 'sesja-karolg',
    category: 'portrait',
    excerpt: 'Studio portraits — natural light, movement and quiet character.',
    cover: sesjaHero,
    gallery: sesjaGallery,
    featured: true,
    year: '2026',
    order: 1,
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

const isStaticExport = process.env.STATIC_EXPORT === '1'

async function getPayloadClient() {
  const [{ default: configPromise }, { getPayload }] = await Promise.all([
    import('@payload-config'),
    import('payload'),
  ])

  return getPayload({ config: configPromise })
}

export async function getProjectBySlug(slug: string): Promise<ProjectLike | null> {
  if (isStaticExport) {
    return fallbackProjects.find((project) => project.slug === slug) || null
  }

  try {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'projects',
      where: { slug: { equals: slug } },
      depth: 1,
      limit: 1,
    })

    return (
      (result.docs[0] as unknown as ProjectLike) ||
      fallbackProjects.find((project) => project.slug === slug) ||
      null
    )
  } catch {
    return fallbackProjects.find((project) => project.slug === slug) || null
  }
}

export async function getPortfolioData() {
  if (isStaticExport) {
    return { site: fallbackSite, projects: fallbackProjects }
  }

  try {
    const payload = await getPayloadClient()
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
