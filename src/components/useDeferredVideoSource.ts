import { useEffect, useState, type RefObject } from 'react'

export const videoAcquisitionRootMargin = '200% 0px'

export function useDeferredVideoSource(
  ref: RefObject<HTMLMediaElement | null>,
  src: string | undefined,
  eager: boolean,
) {
  const [nearViewport, setNearViewport] = useState(false)
  const [requested, setRequested] = useState(false)
  const attachedSrc = eager || nearViewport || requested ? src : undefined

  useEffect(() => {
    const media = ref.current
    if (!media) return
    if (attachedSrc) media.setAttribute('src', attachedSrc)

    return () => {
      media.pause()
      media.removeAttribute('src')
      media.load()
    }
  }, [attachedSrc, ref])

  useEffect(() => {
    const media = ref.current
    if (!media) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNearViewport(true)
      },
      { rootMargin: videoAcquisitionRootMargin },
    )
    observer.observe(media)
    return () => observer.disconnect()
  }, [ref])

  return {
    attachedSrc,
    nearViewport,
    requestAcquisition: () => setRequested(true),
  }
}
