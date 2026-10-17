import { hasPublishedVideoDerivatives, mediaPosterUrl, type MediaLike } from './media'
import { versionMediaURL } from './media-revision'
import type { PayloadRequest, TypeWithID } from 'payload'

export const videoDerivativeURL = (
  mediaId: string | number,
  kind: 'playback' | 'poster',
  revision?: number,
) => versionMediaURL(`/api/media/${mediaId}/${kind}`, revision)!

export function mediaAdminThumbnail({ doc }: { doc: Record<string, unknown> }) {
  if (doc.kind === 'video') {
    const media = doc as MediaLike
    return hasPublishedVideoDerivatives(media) && media.id != null
      ? mediaPosterUrl({ ...media, posterUrl: videoDerivativeURL(media.id, 'poster') })!
      : false
  }

  const sizes = doc.sizes as Record<string, Record<string, unknown>> | undefined
  const cardURL = sizes?.card?.url
  return typeof cardURL === 'string' && cardURL ? versionMediaURL(cardURL, doc.processingRevision)! : false
}

const isVideoDocument = (doc: Record<string, unknown>) =>
  doc.kind === 'video' ||
  (typeof doc.mimeType === 'string' && doc.mimeType.toLowerCase().startsWith('video/'))

export function privateVideoOriginalHandler(
  req: PayloadRequest,
  { doc }: { doc: TypeWithID },
) {
  if (req.user || !isVideoDocument(doc)) return
  return Response.json({ error: 'Not found' }, { status: 404 })
}

export function redactPrivateVideoOriginal<T extends Record<string, unknown>>(
  doc: T,
  authenticated: boolean,
) {
  if (authenticated || !isVideoDocument(doc)) return doc
  return { ...doc, filename: null, url: null }
}
