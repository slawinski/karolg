import { hasPublishedVideoDerivatives, type MediaLike } from './media'
import type { PayloadRequest, TypeWithID } from 'payload'

export const videoDerivativeURL = (
  mediaId: string | number,
  kind: 'playback' | 'poster',
) => `/api/media/${mediaId}/${kind}`

export function mediaAdminThumbnail({ doc }: { doc: Record<string, unknown> }) {
  if (doc.kind === 'video') {
    const media = doc as MediaLike
    return hasPublishedVideoDerivatives(media) && media.id != null
      ? videoDerivativeURL(media.id, 'poster')
      : false
  }

  const sizes = doc.sizes as Record<string, Record<string, unknown>> | undefined
  const cardURL = sizes?.card?.url
  return typeof cardURL === 'string' && cardURL ? cardURL : false
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
