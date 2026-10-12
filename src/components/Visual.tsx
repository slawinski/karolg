import Image from 'next/image'
import { mediaAlt, mediaUrl, type MediaLike } from '@/lib/portfolio'

type VisualProps = {
  media?: MediaLike | string | number | null
  alt: string
  priority?: boolean
  sizes: string
  variant?: number
  className?: string
}

export function Visual({
  media,
  alt,
  priority = false,
  sizes,
  variant = 1,
  className = '',
}: VisualProps) {
  const src = mediaUrl(media)

  if (!src) {
    return (
      <div
        className={`visual-placeholder visual-placeholder-${((variant - 1) % 5) + 1} ${className}`.trim()}
        role="img"
        aria-label={alt}
      />
    )
  }

  return (
    <Image
      src={src}
      alt={mediaAlt(media, alt)}
      fill
      priority={priority}
      sizes={sizes}
      className={`visual-img ${className}`.trim()}
    />
  )
}
