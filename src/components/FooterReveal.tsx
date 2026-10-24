'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'

export function FooterReveal({ children }: { children: ReactNode }) {
  const root = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const node = root.current!
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let disposed = false
    let lastProgress = NaN
    let modal = Boolean(document.querySelector('.photoshoot-viewer[open]'))
    const update = () => {
      frame = 0
      if (disposed) return
      if (motion.matches) {
        lastProgress = NaN
        node.style.removeProperty('--footer-shift')
        node.style.removeProperty('--footer-shade')
        return
      }
      if (document.visibilityState !== 'visible' || modal) return
      const progress = Math.max(0, Math.min(1, (innerHeight - node.getBoundingClientRect().top) / innerHeight))
      if (progress === lastProgress) return
      lastProgress = progress
      node.style.setProperty('--footer-shift', `${-25 * (1 - progress)}%`)
      node.style.setProperty('--footer-shade', String(.5 - .4 * progress))
    }
    const schedule = () => {
      if (!disposed && !frame) frame = requestAnimationFrame(update)
    }
    const visibility = () => {
      cancelAnimationFrame(frame)
      frame = 0
      schedule()
    }
    const dialogs = new MutationObserver(() => {
      const open = Boolean(document.querySelector('.photoshoot-viewer[open]'))
      if (open !== modal) {
        modal = open
        cancelAnimationFrame(frame)
        frame = 0
        schedule()
      }
    })
    dialogs.observe(node.parentElement!, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] })
    const sizes = new ResizeObserver(schedule)
    sizes.observe(node)
    sizes.observe(node.parentElement!)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('pageshow', schedule)
    document.addEventListener('visibilitychange', visibility)
    motion.addEventListener('change', update)
    void document.fonts.ready.then(schedule)
    update()
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      dialogs.disconnect()
      sizes.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('pageshow', schedule)
      document.removeEventListener('visibilitychange', visibility)
      motion.removeEventListener('change', update)
    }
  }, [])
  return <footer ref={root} className="portfolio-footer" aria-label="Portfolio and contact">{children}</footer>
}
