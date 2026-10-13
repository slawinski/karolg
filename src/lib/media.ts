export type PhotographerLike = {
  id?: string | number
  displayName: string
}

export type MediaKind = 'image' | 'video'
export type MediaProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed'

export type MediaLike = {
  id?: string | number
  url?: string | null
  alt?: string | null
  caption?: string | null
  transitionColor?: string | null
  filename?: string | null
  mimeType?: string | null
  filesize?: number | null
  width?: number | null
  height?: number | null
  photographers?: Array<PhotographerLike | string | number> | null
  photoshoot?: PhotoshootReference | string | number | null
  kind?: MediaKind | null
  processingStatus?: MediaProcessingStatus | null
  processingRevision?: number | null
  processingError?: string | null
  duration?: number | null
  videoWidth?: number | null
  videoHeight?: number | null
  playbackFilename?: string | null
  playbackUrl?: string | null
  playbackMimeType?: string | null
  playbackFilesize?: number | null
  posterFilename?: string | null
  posterUrl?: string | null
  posterMimeType?: string | null
  posterWidth?: number | null
  posterHeight?: number | null
}

export type PhotoshootReference = {
  id?: string | number
  title: string
  slug: string
  excerpt?: string | null
  year?: string | null
  order?: number | null
}

const objectValue = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null

const stringValue = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value : null

const numberValue = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

export function normalizePhotographer(value: unknown): PhotographerLike | string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value

  const doc = objectValue(value)
  const displayName = stringValue(doc?.displayName)
  if (!doc || !displayName) return null

  return {
    id:
      typeof doc.id === 'string' || typeof doc.id === 'number'
        ? doc.id
        : undefined,
    displayName,
  }
}

export function inferMediaKind(media: MediaLike | null | undefined): MediaKind {
  if (media?.kind === 'video' || media?.kind === 'image') return media.kind
  if (media?.mimeType?.toLowerCase().startsWith('video/')) return 'video'
  if (media?.playbackFilename || media?.playbackUrl) return 'video'
  return 'image'
}

export function mediaStatus(media: MediaLike | null | undefined): MediaProcessingStatus {
  if (media?.processingStatus) return media.processingStatus
  return inferMediaKind(media) === 'image' ? 'ready' : 'pending'
}

export const originalMediaUrl = (media: MediaLike | null | undefined) =>
  stringValue(media?.url)

export const mediaPosterUrl = (media: MediaLike | null | undefined) =>
  stringValue(media?.posterUrl)

export function mediaPresentationUrl(media: MediaLike | null | undefined) {
  return inferMediaKind(media) === 'video'
    ? stringValue(media?.playbackUrl)
    : originalMediaUrl(media)
}

export function hasPublishedVideoDerivatives(
  media: MediaLike | null | undefined,
) {
  return (
    inferMediaKind(media) === 'video' &&
    Boolean(media?.playbackFilename) &&
    Boolean(media?.posterFilename) &&
    Boolean(mediaPresentationUrl(media)) &&
    Boolean(mediaPosterUrl(media))
  )
}

export function isUsableMedia(media: MediaLike | null | undefined) {
  if (!media) return false
  if (inferMediaKind(media) === 'image') return Boolean(originalMediaUrl(media))

  return hasPublishedVideoDerivatives(media)
}

export const readinessKindForMedia = (media: MediaLike | null | undefined) =>
  inferMediaKind(media) === 'video' ? 'canplay' as const : 'decode' as const

export function mediaDimensions(media: MediaLike | null | undefined) {
  if (!media) return null

  const width =
    inferMediaKind(media) === 'video'
      ? numberValue(media.videoWidth) ?? numberValue(media.posterWidth)
      : numberValue(media.width)
  const height =
    inferMediaKind(media) === 'video'
      ? numberValue(media.videoHeight) ?? numberValue(media.posterHeight)
      : numberValue(media.height)

  return width && height ? { width, height } : null
}

type NormalizeMediaOptions = {
  normalizePhotoshoot?: (value: unknown) => MediaLike['photoshoot']
  urlForFilename?: (filename: string) => string
}

const normalizedStoredColor = (value: unknown) => {
  const color = stringValue(value)?.toLowerCase()
  return color && /^#[0-9a-f]{6}$/.test(color) ? color : null
}

export function normalizeMediaLike(
  value: unknown,
  options: NormalizeMediaOptions = {},
): MediaLike | null {
  const doc = objectValue(value)
  if (!doc) return null

  const filename = stringValue(doc.filename)
  const playbackFilename = stringValue(doc.playbackFilename)
  const posterFilename = stringValue(doc.posterFilename)
  const urlForFilename = options.urlForFilename
  const photographers = Array.isArray(doc.photographers)
    ? doc.photographers
        .map(normalizePhotographer)
        .filter((item): item is PhotographerLike | string | number => item !== null)
    : []

  const media: MediaLike = {
    id:
      typeof doc.id === 'string' || typeof doc.id === 'number'
        ? doc.id
        : undefined,
    url: filename && urlForFilename ? urlForFilename(filename) : stringValue(doc.url),
    alt: stringValue(doc.alt),
    caption: stringValue(doc.caption),
    transitionColor: normalizedStoredColor(doc.transitionColor),
    filename,
    mimeType: stringValue(doc.mimeType),
    filesize: numberValue(doc.filesize),
    width: numberValue(doc.width),
    height: numberValue(doc.height),
    photographers,
    photoshoot: options.normalizePhotoshoot
      ? options.normalizePhotoshoot(doc.photoshoot)
      : ((doc.photoshoot as MediaLike['photoshoot']) ?? null),
    kind: doc.kind === 'video' || doc.kind === 'image' ? doc.kind : null,
    processingStatus:
      doc.processingStatus === 'pending' ||
      doc.processingStatus === 'processing' ||
      doc.processingStatus === 'ready' ||
      doc.processingStatus === 'failed'
        ? doc.processingStatus
        : null,
    processingRevision: numberValue(doc.processingRevision),
    processingError: stringValue(doc.processingError),
    duration: numberValue(doc.duration),
    videoWidth: numberValue(doc.videoWidth),
    videoHeight: numberValue(doc.videoHeight),
    playbackFilename,
    playbackUrl:
      playbackFilename && urlForFilename
        ? urlForFilename(playbackFilename)
        : stringValue(doc.playbackUrl),
    playbackMimeType: stringValue(doc.playbackMimeType),
    playbackFilesize: numberValue(doc.playbackFilesize),
    posterFilename,
    posterUrl:
      posterFilename && urlForFilename
        ? urlForFilename(posterFilename)
        : stringValue(doc.posterUrl),
    posterMimeType: stringValue(doc.posterMimeType),
    posterWidth: numberValue(doc.posterWidth),
    posterHeight: numberValue(doc.posterHeight),
  }

  media.kind = inferMediaKind(media)
  media.processingStatus = mediaStatus(media)
  if (media.kind === 'video') {
    media.filename = null
    media.url = null
  }
  return media
}
