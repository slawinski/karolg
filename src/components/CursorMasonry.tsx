'use client'

import {
  Children,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'

type CursorMasonryProps = {
  children: ReactNode
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const columnsForWidth = (width: number) => {
  if (width <= 700) return 1
  if (width <= 1100) return 3
  return 4
}

export function CursorMasonry({ children }: CursorMasonryProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const [columnCount, setColumnCount] = useState(4)

  useEffect(() => {
    const updateColumns = () => setColumnCount(columnsForWidth(window.innerWidth))

    updateColumns()
    window.addEventListener('resize', updateColumns)

    return () => window.removeEventListener('resize', updateColumns)
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    const rail = railRef.current

    if (!viewport || !rail) return

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    if (!finePointer.matches || reducedMotion.matches || columnCount === 1) {
      rail.style.removeProperty('transform')
      return
    }

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
  }, [columnCount])

  const items = Children.toArray(children)
  const columns = Array.from({ length: columnCount }, (_, columnIndex) =>
    items.filter((_, itemIndex) => itemIndex % columnCount === columnIndex),
  )

  return (
    <div className="cursor-masonry" ref={viewportRef}>
      <div
        className="cursor-masonry__rail"
        ref={railRef}
        style={{ '--masonry-columns': columnCount } as React.CSSProperties}
      >
        {columns.map((column, columnIndex) => (
          <div
            className="cursor-masonry__column"
            data-column={columnIndex + 1}
            key={columnIndex}
          >
            {column}
          </div>
        ))}
      </div>
    </div>
  )
}
