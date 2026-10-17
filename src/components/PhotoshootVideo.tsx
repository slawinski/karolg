'use client'

import Image from 'next/image'
import { useRef } from 'react'
import { mediaPosterUrl, mediaPresentationUrl, type MediaLike } from '@/lib/media'
import { mediaRevision } from '@/lib/media-revision'
import { useDeferredVideoSource } from './useDeferredVideoSource'

type PhotoshootVideoProps = {
  alt: string
  className: string
  media: MediaLike
  eager?: boolean
  sizes?: string
}

export function PhotoshootVideo({ alt, className, media, eager = false, sizes = '100vw' }: PhotoshootVideoProps) {
  const ref = useRef<HTMLVideoElement>(null)
  const src = mediaPresentationUrl(media) || undefined
  const poster = mediaPosterUrl(media)
  const { attachedSrc, playing } = useDeferredVideoSource(ref, src, false)

  return <>
    <video ref={ref} src={attachedSrc} aria-label={alt} muted loop playsInline
      preload={attachedSrc ? 'metadata' : 'none'} className={className}>
      Your browser does not support video playback.
    </video>
    {poster ? <Image src={poster} alt="" aria-hidden="true" fill
      unoptimized={mediaRevision(media.processingRevision) === null}
      loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined}
      data-public-critical={eager || undefined} sizes={sizes} className="media-poster photoshoot-video-poster"
      style={{ opacity: playing ? 0 : 1 }} /> : null}
  </>
}
