'use client'

import { type ReactNode, useEffect } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { homepageMotionQuery } from '@/lib/homepage-motion'

export function HomepageScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    const eligibility = window.matchMedia(homepageMotionQuery)
    let dispose: (() => void) | undefined
    const update = () => {
      dispose?.()
      dispose = undefined
      if (!eligibility.matches) return

      const root = document.documentElement
      const previousBehavior = root.getAttribute('data-scroll-behavior')
      root.setAttribute('data-scroll-behavior', 'auto')
      const lenis = new Lenis({
        autoRaf: true, autoResize: true, lerp: 0.1,
        smoothWheel: true, wheelMultiplier: 1, syncTouch: false, anchors: false,
      })
      let frame = 0
      const synchronize = () => {
        lenis.resize()
        lenis.scrollTo(window.scrollY, { immediate: true, force: true })
      }
      const interrupt = () => {
        // Reset the old wheel destination before the browser/router takes over.
        lenis.stop()
        lenis.start()
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(synchronize)
      }
      const click = (event: MouseEvent) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        const link = event.target instanceof Element ? event.target.closest('a[href]') : null
        if (!(link instanceof HTMLAnchorElement) || link.download || (link.target && link.target !== '_self')) return
        const url = new URL(link.href)
        if (url.origin === location.origin) interrupt()
      }
      const key = (event: KeyboardEvent) => {
        const target = event.target
        if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select'))) return
        if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) interrupt()
      }
      const pointer = (event: PointerEvent) => {
        click(event)
        if (event.pointerType === 'mouse' && event.clientX >= root.clientWidth) interrupt()
      }
      document.addEventListener('click', click, true)
      document.addEventListener('keydown', key, true)
      window.addEventListener('pointerdown', pointer, true)
      window.addEventListener('pageshow', interrupt)
      window.addEventListener('popstate', interrupt)
      window.addEventListener('hashchange', interrupt)
      dispose = () => {
        cancelAnimationFrame(frame)
        document.removeEventListener('click', click, true)
        document.removeEventListener('keydown', key, true)
        window.removeEventListener('pointerdown', pointer, true)
        window.removeEventListener('pageshow', interrupt)
        window.removeEventListener('popstate', interrupt)
        window.removeEventListener('hashchange', interrupt)
        lenis.destroy()
        if (previousBehavior === null) root.removeAttribute('data-scroll-behavior')
        else root.setAttribute('data-scroll-behavior', previousBehavior)
      }
    }
    update()
    eligibility.addEventListener('change', update)
    return () => { eligibility.removeEventListener('change', update); dispose?.() }
  }, [])
  return children
}
