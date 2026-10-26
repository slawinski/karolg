import { type RefObject, useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { homepageMotionQuery } from '@/lib/homepage-motion'

const durations = [0.5, 0.8, 0.2, 0.3, 0.6]

export function useHomepageColumnScroll(
  viewportRef: RefObject<HTMLDivElement | null>,
  railRef: RefObject<HTMLDivElement | null>,
  invalidatePointer: RefObject<() => void>,
  topology: string,
) {
  const reconcileRef = useRef(() => {})
  useEffect(() => {
    const viewport = viewportRef.current
    const rail = railRef.current
    if (!viewport || !rail) return
    const eligibility = matchMedia(homepageMotionQuery)
    let dispose: (() => void) | undefined
    const update = () => {
      dispose?.()
      dispose = undefined
      if (!eligibility.matches) return

      let target = 0
      let bound = 0
      const tweens = new Map<HTMLElement, ReturnType<typeof gsap.quickTo>>()
      const retarget = (next: number) => {
        next = Math.max(-bound, Math.min(0, next))
        if (next === target) return
        target = next
        tweens.forEach((to) => to(target))
      }
      const observer = new ResizeObserver(() => reconcile())
      const reconcile = () => {
        const columns = [...rail.children].filter((column): column is HTMLElement =>
          column instanceof HTMLElement && column.clientWidth > 0 && Boolean(column.querySelector('.masonry-card')),
        )
        for (const [column, to] of tweens) {
          if (columns.includes(column)) continue
          to.tween.kill()
          gsap.set(column, { clearProps: 'transform' })
          observer.unobserve(column)
          tweens.delete(column)
        }
        for (const column of columns) {
          if (tweens.has(column)) continue
          gsap.set(column, { y: target })
          const index = Number(column.dataset.column) - 1
          tweens.set(column, gsap.quickTo(column, 'y', {
            duration: durations[index], ease: 'power3.out',
            onUpdate: () => invalidatePointer.current(),
          }))
          observer.observe(column)
        }
        bound = Math.max(0, ...columns.map((column) => column.clientHeight / 2))
        retarget(target)
      }
      const wheel = (event: WheelEvent) => {
        if (event.ctrlKey) return
        const rect = viewport.getBoundingClientRect()
        if (rect.bottom <= 0 || rect.top >= innerHeight || rect.height === 0) return
        retarget(target - event.deltaY / 2)
      }
      reconcileRef.current = reconcile
      reconcile()
      window.addEventListener('wheel', wheel, { passive: true })
      window.addEventListener('resize', reconcile)
      dispose = () => {
        reconcileRef.current = () => {}
        window.removeEventListener('wheel', wheel)
        window.removeEventListener('resize', reconcile)
        observer.disconnect()
        tweens.forEach((to, column) => {
          to.tween.kill()
          gsap.set(column, { clearProps: 'transform' })
        })
        tweens.clear()
      }
    }
    update()
    eligibility.addEventListener('change', update)
    return () => { eligibility.removeEventListener('change', update); dispose?.() }
  }, [viewportRef, railRef, invalidatePointer])

  useEffect(() => { reconcileRef.current() }, [topology])
}
