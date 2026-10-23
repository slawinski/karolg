'use client'

import { useLayoutEffect } from 'react'

export function PhotoshootScrollReset({ slug }: { slug: string }) {
  useLayoutEffect(() => {
    const restoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    let frame = 0
    const reset = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      cancelAnimationFrame(frame)
      // Run after router/browser history restoration as well as before the first paint.
      frame = requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }))
    }
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) reset()
    }
    reset()
    window.addEventListener('pageshow', restore)
    return () => {
      if (restoration === 'auto') window.history.scrollRestoration = restoration
      cancelAnimationFrame(frame)
      window.removeEventListener('pageshow', restore)
    }
  }, [slug])

  return null
}
