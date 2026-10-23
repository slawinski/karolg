'use client'

import { useLayoutEffect } from 'react'

export function PhotoshootScrollReset({ slug }: { slug: string }) {
  useLayoutEffect(() => {
    let frame = 0
    const reset = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      cancelAnimationFrame(frame)
      // Run after router/browser history restoration as well as before the first paint.
      frame = requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }))
    }
    reset()
    window.addEventListener('load', reset)
    window.addEventListener('pageshow', reset)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('load', reset)
      window.removeEventListener('pageshow', reset)
    }
  }, [slug])

  return null
}
