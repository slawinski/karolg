import { useEffect, useRef, useState, type RefObject } from 'react'
import { usePublicMediaReady } from './PublicMediaReadiness'

export function useDeferredVideoSource(
  ref: RefObject<HTMLMediaElement | null>,
  src: string | undefined,
  preparing: boolean,
  active = true,
) {
  const ready = usePublicMediaReady()
  const [visible, setVisible] = useState(false)
  const [motionSafe, setMotionSafe] = useState(false)
  const [acquired, setAcquired] = useState<string>()
  const [failed, setFailed] = useState<string>()
  const [playing, setPlaying] = useState<string>()
  const eligible = ready && motionSafe && visible && active && failed !== src
  const eligibleRef = useRef(eligible)
  eligibleRef.current = eligible
  const attachedSrc = acquired === src ? src : undefined

  useEffect(() => {
    const media = ref.current
    if (!media) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setMotionSafe(document.visibilityState === 'visible' && !motion.matches)
    update()
    document.addEventListener('visibilitychange', update)
    motion.addEventListener('change', update)
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.1)
    }, { threshold: [0, 0.1, 1] })
    observer.observe(media)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', update)
      motion.removeEventListener('change', update)
    }
  }, [ref])

  useEffect(() => {
    if (ready && motionSafe && (visible || preparing)) setAcquired(src)
  }, [ready, motionSafe, visible, preparing, src])

  useEffect(() => {
    const media = ref.current
    if (!media || !attachedSrc) return
    media.setAttribute('src', attachedSrc)
    return () => {
      media.pause()
      media.removeAttribute('src')
      media.load()
    }
  }, [attachedSrc, ref])

  useEffect(() => {
    const media = ref.current
    if (!media) return
    let current = true
    setPlaying(undefined)
    const fail = () => { if (current) { setFailed(src); setPlaying(undefined) } }
    media.addEventListener('error', fail)
    if (eligible && attachedSrc) {
      void media.play().then(() => {
        if (!current) {
          // A newer eligible effect may already own this element. Never pause
          // that newer start, but do stop an obsolete hidden/unmounted start.
          if (!eligibleRef.current || !media.isConnected || document.visibilityState !== 'visible' ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches) media.pause()
          return
        }
        setPlaying(src)
      }).catch((error: unknown) => {
        if (current && !(error instanceof DOMException && error.name === 'AbortError')) fail()
      })
    } else media.pause()
    return () => { current = false; media.removeEventListener('error', fail); media.pause() }
  }, [eligible, attachedSrc, src, ref])

  return { attachedSrc, playing: playing === src && eligible, failed: failed === src }
}
