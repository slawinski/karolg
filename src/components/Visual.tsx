import Image from 'next/image'
import { mediaAlt, mediaUrl, type MediaLike } from '@/lib/portfolio'
import { inferMediaKind, isUsableMedia } from '@/lib/media'
import { mediaRevision } from '@/lib/media-revision'
import { PhotoshootVideo } from './PhotoshootVideo'

type VisualProps = {
  media?: MediaLike | string | number | null
  alt: string
  eager?: boolean
  sizes: string
  variant?: number
  className?: string
}

export function Visual({
  media,
  alt,
  eager = false,
  sizes,
  variant = 1,
  className = '',
}: VisualProps) {
  const src = mediaUrl(media)

  const normalizedMedia = media && typeof media === 'object' ? media : null

  if (!src || !normalizedMedia || !isUsableMedia(normalizedMedia)) {
    return (
      <div
        className={`visual-placeholder visual-placeholder-${((variant - 1) % 5) + 1} ${className}`.trim()}
        role="img"
        aria-label={alt}
      />
    )
  }

  if (inferMediaKind(normalizedMedia) === 'video') {
    return (
      <PhotoshootVideo
        alt={mediaAlt(media, alt)}
        className={`visual-img visual-video ${className}`.trim()}
        media={normalizedMedia}
      />
    )
  }

  return (
    <Image
      src={src}
      unoptimized={mediaRevision(normalizedMedia?.processingRevision) === null}
      alt={mediaAlt(media, alt)}
      fill
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      sizes={sizes}
      className={`visual-img ${className}`.trim()}
    />
  )
}
