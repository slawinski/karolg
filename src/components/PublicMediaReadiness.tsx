'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

// Standalone media remains usable; public routes always install the boundary.
const MediaReady = createContext(true)
export const usePublicMediaReady = () => useContext(MediaReady)

export function PublicMediaReadiness({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  return <Readiness key={routeKey}>{children}</Readiness>
}

function Readiness({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    let imagesSettled = false
    let delaySettled = false
    let remaining = 1500
    let started = 0
    let timer = 0
    let frame = 0
    const cleanupImages: (() => void)[] = []
    const finish = () => {
      if (cancelled || !imagesSettled || !delaySettled || document.visibilityState !== 'visible') return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (!cancelled && document.visibilityState === 'visible') setReady(true)
        })
      })
    }
    const visibility = () => {
      clearTimeout(timer)
      if (started) remaining = Math.max(0, remaining - (performance.now() - started))
      started = 0
      if (document.visibilityState === 'visible') {
        started = performance.now()
        timer = window.setTimeout(() => { delaySettled = true; finish() }, remaining)
        finish()
      } else cancelAnimationFrame(frame)
    }
    // Scan after hydration's responsive topology update, not window.load.
    const scanFrame = requestAnimationFrame(() => {
      const images = [...(root.current?.querySelectorAll<HTMLImageElement>('img[data-public-critical]') || [])]
      let pending = images.length
      const settle = () => { if (--pending === 0) { imagesSettled = true; finish() } }
      images.forEach((image) => {
        const decoded = () => { void image.decode().catch(() => undefined).then(settle) }
        if (image.complete) { decoded(); return }
        const done = () => { image.removeEventListener('load', done); image.removeEventListener('error', done); decoded() }
        image.addEventListener('load', done)
        image.addEventListener('error', done)
        cleanupImages.push(() => { image.removeEventListener('load', done); image.removeEventListener('error', done) })
      })
      if (!images.length) { imagesSettled = true; finish() }
    })
    visibility()
    document.addEventListener('visibilitychange', visibility)
    return () => {
      cancelled = true
      clearTimeout(timer)
      cancelAnimationFrame(scanFrame)
      cancelAnimationFrame(frame)
      cleanupImages.forEach((cleanup) => cleanup())
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])
  return <MediaReady value={ready}><div ref={root} style={{ display: 'contents' }} data-public-media-ready={ready}>{children}</div></MediaReady>
}
