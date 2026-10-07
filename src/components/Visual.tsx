import Image from 'next/image'
import { mediaAlt, mediaUrl, type MediaLike } from '@/lib/portfolio'

type VisualProps = {
  media?: MediaLike | string | number | null
  alt: string
  priority?: boolean
  sizes: string
  variant?: number
  /** Marks the active pull: signal-red separation bed + stronger dot screen. */
  select?: boolean
  className?: string
}

export function Visual({
  media,
  alt,
  priority = false,
  sizes,
  variant = 1,
  select = false,
  className = '',
}: VisualProps) {
  const src = mediaUrl(media)
  const pullClass = `pull${select ? ' is-select' : ''}${className ? ` ${className}` : ''}`

  if (!src) {
    return (
      <div className={pullClass}>
        <div
          className={`placeholder placeholder-${((variant - 1) % 6) + 1}`}
          role="img"
          aria-label={alt}
        />
        <span className="pull-dots" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className={pullClass}>
      <span className="pull-bed" aria-hidden="true" />
      <Image
        src={src}
        alt={mediaAlt(media, alt)}
        fill
        priority={priority}
        sizes={sizes}
        className="pull-img"
      />
      <span className="pull-dots" aria-hidden="true" />
    </div>
  )
}
