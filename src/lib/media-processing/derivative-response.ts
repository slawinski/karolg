import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import type { MediaLike } from '../media'
import { hasPublishedVideoDerivatives } from '../media'
import { resolveOwnedDerivativePath, type DerivativeKind } from './paths'

type DerivativePayload = {
  findByID(args: {
    collection: 'media'
    id: number
    depth: 0
    overrideAccess: true
  }): Promise<unknown>
}

type ServeDerivativeOptions = {
  payload: DerivativePayload
  request: Request
  rawId: unknown
  kind: DerivativeKind
  mediaRoot?: string
}

type ByteRange = { start: number; end: number }

export function parseSingleByteRange(
  header: string | null,
  size: number,
): ByteRange | null | 'invalid' {
  if (!header) return null
  if (!header.startsWith('bytes=') || header.includes(',')) return 'invalid'

  const match = header.match(/^bytes=(\d*)-(\d*)$/)
  if (!match || (!match[1] && !match[2]) || size < 1) return 'invalid'

  if (!match[1]) {
    const suffix = Number(match[2])
    if (!Number.isSafeInteger(suffix) || suffix < 1) return 'invalid'
    return { start: Math.max(0, size - suffix), end: size - 1 }
  }

  const start = Number(match[1])
  const requestedEnd = match[2] ? Number(match[2]) : size - 1
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    start >= size ||
    requestedEnd < start
  ) {
    return 'invalid'
  }
  return { start, end: Math.min(requestedEnd, size - 1) }
}

const notFound = () => Response.json({ error: 'Media derivative not found' }, { status: 404 })

export async function serveMediaDerivative({
  payload,
  request,
  rawId,
  kind,
  mediaRoot,
}: ServeDerivativeOptions) {
  const raw = typeof rawId === 'string' ? rawId : ''
  if (!/^[1-9]\d*$/.test(raw)) return notFound()

  const id = Number(raw)
  if (!Number.isSafeInteger(id)) return notFound()

  try {
    const media = await payload.findByID({
      collection: 'media',
      id,
      depth: 0,
      overrideAccess: true,
    }) as MediaLike
    if (!hasPublishedVideoDerivatives(media)) return notFound()

    const storedPath = kind === 'playback'
      ? media.playbackFilename
      : media.posterFilename
    if (!storedPath) return notFound()

    const { absolutePath } = resolveOwnedDerivativePath(
      storedPath,
      id,
      kind,
      mediaRoot,
    )
    const details = await stat(absolutePath)
    if (!details.isFile()) return notFound()

    const contentType = kind === 'playback'
      ? media.playbackMimeType === 'video/mp4' ? 'video/mp4' : null
      : 'image/jpeg'
    if (!contentType) return notFound()

    const range = parseSingleByteRange(request.headers.get('range'), details.size)
    const headers = new Headers({
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=300',
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
    })

    if (range === 'invalid') {
      headers.set('Content-Range', `bytes */${details.size}`)
      return new Response(null, { status: 416, headers })
    }

    const start = range?.start ?? 0
    const end = range?.end ?? details.size - 1
    const contentLength = end - start + 1
    headers.set('Content-Length', String(contentLength))
    if (range) headers.set('Content-Range', `bytes ${start}-${end}/${details.size}`)

    if (request.method === 'HEAD') {
      return new Response(null, { status: range ? 206 : 200, headers })
    }

    const stream = Readable.toWeb(createReadStream(absolutePath, { start, end }))
    return new Response(stream as BodyInit, {
      status: range ? 206 : 200,
      headers,
    })
  } catch {
    return notFound()
  }
}
