import Image from 'next/image'
import { mediaAlt, mediaUrl, type MediaLike } from '@/lib/portfolio'
import { inferMediaKind, isUsableMedia, mediaPosterUrl } from '@/lib/media'
import { mediaRevision } from '@/lib/media-revision'

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

  if (!src || !isUsableMedia(normalizedMedia)) {
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
      <video
        src={src}
        poster={mediaPosterUrl(normalizedMedia) || undefined}
        aria-label={mediaAlt(media, alt)}
        controls
        playsInline
        preload="metadata"
        className={`visual-img visual-video ${className}`.trim()}
      >
        Your browser does not support video playback.
      </video>
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
