import Image from 'next/image'
import { mediaAlt, mediaUrl, type MediaLike } from '@/lib/portfolio'

export function Visual({
  media,
  alt,
  priority = false,
  sizes,
  variant = 1,
}: {
  media?: MediaLike | string | number | null
  alt: string
  priority?: boolean
  sizes: string
  variant?: number
}) {
  const src = mediaUrl(media)

  if (!src) {
    return (
      <div
        className={`placeholder placeholder-${((variant - 1) % 6) + 1}`}
        role="img"
        aria-label={alt}
      />
    )
  }

  return <Image src={src} alt={mediaAlt(media, alt)} fill priority={priority} sizes={sizes} />
}
