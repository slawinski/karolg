'use client'

import { useRef } from 'react'
import { mediaPosterUrl, mediaPresentationUrl, type MediaLike } from '@/lib/media'
import { useDeferredVideoSource } from './useDeferredVideoSource'

type PhotoshootVideoProps = {
  alt: string
  className: string
  media: MediaLike
}

export function PhotoshootVideo({ alt, className, media }: PhotoshootVideoProps) {
  const ref = useRef<HTMLVideoElement>(null)
  const src = mediaPresentationUrl(media) || undefined
  const { attachedSrc, nearViewport, requestAcquisition } = useDeferredVideoSource(
    ref,
    src,
    false,
  )

  return (
    <video
      ref={ref}
      src={attachedSrc}
      poster={mediaPosterUrl(media) || undefined}
      aria-label={alt}
      controls
      playsInline
      preload={attachedSrc || nearViewport ? 'metadata' : 'none'}
      className={className}
      onPointerDown={requestAcquisition}
      onFocus={requestAcquisition}
    >
      Your browser does not support video playback.
    </video>
  )
}
