import {
  normalizeMediaLike,
  normalizePhotographer,
  type MediaLike,
  type PhotographerLike,
  type PhotoshootReference,
} from './media'

export type SnapshotDocument = Record<string, unknown>

export const documentsById = (documents: SnapshotDocument[]) =>
  new Map(documents.map((document) => [String(document.id), document]))

export function normalizeSnapshotPhotoshoot(
  value: unknown,
  photoshootsById: Map<string, SnapshotDocument>,
  photographersById: Map<string, SnapshotDocument>,
): PhotoshootReference | null {
  const document = value && typeof value === 'object'
    ? value as SnapshotDocument
    : photoshootsById.get(String(value))
  if (!document) return null

  const photographers = Array.isArray(document.photographers)
    ? document.photographers.map((photographer) => {
        const expanded = photographer && typeof photographer === 'object'
          ? photographer
          : photographersById.get(String(photographer)) ?? photographer
        return normalizePhotographer(expanded)
      }).filter((item): item is PhotographerLike | string | number => item !== null)
    : []

  return {
    id: typeof document.id === 'string' || typeof document.id === 'number'
      ? document.id
      : undefined,
    title: typeof document.title === 'string' ? document.title : '',
    slug: typeof document.slug === 'string' ? document.slug : '',
    excerpt: typeof document.excerpt === 'string' ? document.excerpt : null,
    year: typeof document.year === 'string' ? document.year : null,
    order: typeof document.order === 'number' ? document.order : null,
    photographers,
  }
}

export function normalizeSnapshotMedia(
  value: unknown,
  photoshootsById: Map<string, SnapshotDocument>,
  photographersById: Map<string, SnapshotDocument>,
): MediaLike | null {
  if (!value || typeof value !== 'object') return null
  const document = value as SnapshotDocument

  return normalizeMediaLike(
    document,
    {
      normalizePhotoshoot: (photoshoot) =>
        normalizeSnapshotPhotoshoot(photoshoot, photoshootsById, photographersById),
      urlForFilename: (filename) => `/media/${filename}`,
    },
  )
}
