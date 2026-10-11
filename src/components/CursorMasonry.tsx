'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'

type CursorMasonryProps = {
  children: ReactNode
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export function CursorMasonry({ children }: CursorMasonryProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const viewport = viewportRef.current
    const rail = railRef.current

    if (!viewport || !rail) return

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    if (!finePointer.matches || reducedMotion.matches) return

    let current = 0.5
    let target = 0.5
    let animationFrame = 0

    const apply = () => {
      const overflow = Math.max(0, rail.scrollWidth - viewport.clientWidth)
      rail.style.transform = `translate3d(${-overflow * current}px, 0, 0)`
    }

    const tick = () => {
      animationFrame = 0
      current += (target - current) * 0.14
      apply()

      if (Math.abs(target - current) > 0.001) {
        animationFrame = window.requestAnimationFrame(tick)
      } else {
        current = target
        apply()
      }
    }

    const animateToTarget = () => {
      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(tick)
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = viewport.getBoundingClientRect()
      const progress = clamp((event.clientX - bounds.left) / bounds.width, 0, 1)

      // Left edge shows the first column; right edge reveals the extra final column.
      target = progress
      animateToTarget()
    }

    const handlePointerLeave = () => {
      target = 0.5
      animateToTarget()
    }

    const resizeObserver = new ResizeObserver(apply)

    viewport.addEventListener('pointermove', handlePointerMove)
    viewport.addEventListener('pointerleave', handlePointerLeave)
    resizeObserver.observe(viewport)
    resizeObserver.observe(rail)

    apply()

    return () => {
      viewport.removeEventListener('pointermove', handlePointerMove)
      viewport.removeEventListener('pointerleave', handlePointerLeave)
      resizeObserver.disconnect()

      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
      }

      rail.style.removeProperty('transform')
    }
  }, [])

  return (
    <div className="cursor-masonry" ref={viewportRef}>
      <div className="masonry-grid cursor-masonry__rail" ref={railRef}>
        {children}
      </div>
    </div>
  )
}
