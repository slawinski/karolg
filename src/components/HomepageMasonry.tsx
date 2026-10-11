'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  type AnimationEvent,
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { MediaLike } from '@/lib/portfolio'

export type HomepageMasonrySlot = {
  id: string
  photoshootSlug: string
  photoshootTitle: string
  images: MediaLike[]
  startIndex: number
}

type ActiveSwap = {
  slotId: string
  nextIndex: number
  frameColor: string
}

const galleryMotion = {
  totalMs: 1500,
  initialDelayMs: 3000,
  betweenCyclesMs: 3000,
  minimumPoolSize: 2,
  maximumPoolSize: 5,
  preloadTimeoutMs: 5000,
} as const

const transitionPalette = [
  '#b8afa5',
  '#c9c4ba',
  '#a9a49b',
  '#d8d3ca',
  '#948d84',
]

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const columnsForWidth = (width: number) => {
  if (width <= 700) return 2
  if (width <= 1100) return 3
  return 4
}

const sourceOf = (image: MediaLike | undefined) => image?.url || null

const usablePool = (slot: HomepageMasonrySlot) =>
  slot.images
    .filter((image) => Boolean(sourceOf(image)))
    .slice(0, galleryMotion.maximumPoolSize)

const initialIndex = (slot: HomepageMasonrySlot) => {
  const pool = usablePool(slot)
  return pool.length ? slot.startIndex % pool.length : 0
}

const paletteIndex = (image: MediaLike | undefined, fallback: number) => {
  const key = String(image?.id ?? image?.filename ?? fallback)
  let hash = 0

  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0
  }

  return hash % transitionPalette.length
}

const preloadAndDecode = (src: string, timeoutMs: number) =>
  new Promise<boolean>((resolve) => {
    const image = new window.Image()
    let settled = false

    const finish = (result: boolean) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      resolve(result)
    }

    const timeout = window.setTimeout(() => finish(false), timeoutMs)

    image.onload = () => {
      if (typeof image.decode !== 'function') {
        finish(true)
        return
      }

      void image.decode().then(
        () => finish(true),
        () => finish(false),
      )
    }
    image.onerror = () => finish(false)
    image.src = src
  })

export function HomepageMasonry({ slots }: { slots: HomepageMasonrySlot[] }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const currentIndexesRef = useRef<Record<string, number>>({})
  const activeSwapRef = useRef<ActiveSwap | null>(null)
  const generationRef = useRef(0)
  const roundRobinRef = useRef(0)

  const [columnCount, setColumnCount] = useState(4)
  const [currentIndexes, setCurrentIndexes] = useState<Record<string, number>>({})
  const [activeSwap, setActiveSwap] = useState<ActiveSwap | null>(null)
  const [heroEligible, setHeroEligible] = useState(false)
  const [cycle, setCycle] = useState(0)

  const columns = useMemo(
    () =>
      Array.from({ length: columnCount }, (_, columnIndex) =>
        slots.filter((_, slotIndex) => slotIndex % columnCount === columnIndex),
      ),
    [columnCount, slots],
  )

  const leadingSlots = useMemo(
    () => columns.map((column) => column[0]).filter(Boolean),
    [columns],
  )

  useEffect(() => {
    currentIndexesRef.current = currentIndexes
  }, [currentIndexes])

  useEffect(() => {
    activeSwapRef.current = activeSwap
  }, [activeSwap])

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

    if (!finePointer.matches || reducedMotion.matches) {
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
      if (!animationFrame) animationFrame = window.requestAnimationFrame(tick)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = viewport.getBoundingClientRect()
      target = clamp((event.clientX - bounds.left) / bounds.width, 0, 1)
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

      if (animationFrame) window.cancelAnimationFrame(animationFrame)
      rail.style.removeProperty('transform')
    }
  }, [columnCount])

  useEffect(() => {
    const viewport = viewportRef.current
    const stage = viewport?.closest('.masonry-stage')
    const title = stage?.querySelector('.masonry-name')
    const firstCards = Array.from(
      viewport?.querySelectorAll('[data-first-row="true"]') || [],
    )

    if (!title || !firstCards.length) {
      setHeroEligible(false)
      return
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let titleVisible = false
    const firstRowVisibility = new Map<Element, number>()
    let pageVisible = document.visibilityState === 'visible'
    let reduced = reducedMotion.matches

    const updateEligibility = () => {
      const firstRowVisible = Array.from(firstRowVisibility.values()).some(
        (ratio) => ratio >= 0.1,
      )

      setHeroEligible((titleVisible || firstRowVisible) && pageVisible && !reduced)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === title) {
            titleVisible = entry.isIntersecting && entry.intersectionRatio > 0
          } else {
            firstRowVisibility.set(
              entry.target,
              entry.isIntersecting ? entry.intersectionRatio : 0,
            )
          }
        }

        updateEligibility()
      },
      { threshold: [0, 0.1, 1] },
    )

    observer.observe(title)
    firstCards.forEach((card) => {
      firstRowVisibility.set(card, 0)
      observer.observe(card)
    })

    const handleVisibility = () => {
      pageVisible = document.visibilityState === 'visible'
      updateEligibility()
    }

    const handleMotionPreference = (event: MediaQueryListEvent) => {
      reduced = event.matches
      updateEligibility()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    reducedMotion.addEventListener('change', handleMotionPreference)

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
      reducedMotion.removeEventListener('change', handleMotionPreference)
    }
  }, [columnCount, slots.length])

  const settleActiveSwap = useCallback((commitIncoming = true) => {
    const active = activeSwapRef.current
    if (!active) return

    if (commitIncoming) {
      setCurrentIndexes((current) => {
        const next = { ...current, [active.slotId]: active.nextIndex }
        currentIndexesRef.current = next
        return next
      })
    }

    activeSwapRef.current = null
    setActiveSwap(null)
    setCycle((value) => value + 1)
  }, [])

  useEffect(() => {
    if (heroEligible) return

    generationRef.current += 1
    settleActiveSwap(true)
  }, [heroEligible, settleActiveSwap])

  useEffect(() => {
    // A responsive column-count change can redefine which cards are first-row cards.
    // Always settle before allowing the scheduler to use the new topology.
    generationRef.current += 1
    settleActiveSwap(true)
  }, [columnCount, settleActiveSwap])

  useEffect(() => {
    if (!heroEligible || activeSwap) return

    const eligible = leadingSlots.filter(
      (slot) => usablePool(slot).length >= galleryMotion.minimumPoolSize,
    )

    if (!eligible.length) return

    const generation = ++generationRef.current
    const delay =
      cycle === 0 ? galleryMotion.initialDelayMs : galleryMotion.betweenCyclesMs

    const timer = window.setTimeout(() => {
      const slot = eligible[roundRobinRef.current % eligible.length]
      roundRobinRef.current += 1

      const pool = usablePool(slot)
      const currentIndex =
        currentIndexesRef.current[slot.id] ?? initialIndex(slot)
      const nextIndex = (currentIndex + 1) % pool.length
      const nextSrc = sourceOf(pool[nextIndex])

      if (!nextSrc) {
        setCycle((value) => value + 1)
        return
      }

      void preloadAndDecode(nextSrc, galleryMotion.preloadTimeoutMs).then((decoded) => {
        if (!decoded || generation !== generationRef.current) {
          if (generation === generationRef.current) {
            setCycle((value) => value + 1)
          }
          return
        }

        const currentImage = pool[currentIndex]
        const nextSwap = {
          slotId: slot.id,
          nextIndex,
          frameColor:
            transitionPalette[
              paletteIndex(currentImage, roundRobinRef.current)
            ],
        }

        activeSwapRef.current = nextSwap
        setActiveSwap(nextSwap)
      })
    }, delay)

    return () => {
      window.clearTimeout(timer)
      generationRef.current += 1
    }
  }, [activeSwap, cycle, heroEligible, leadingSlots])

  const handleColumnAnimationEnd = (
    event: AnimationEvent<HTMLDivElement>,
    firstSlot: HomepageMasonrySlot | undefined,
  ) => {
    if (
      event.target !== event.currentTarget ||
      event.animationName !== 'gallery-column-move' ||
      !firstSlot ||
      activeSwapRef.current?.slotId !== firstSlot.id
    ) {
      return
    }

    settleActiveSwap(true)
  }

  return (
    <div className="cursor-masonry" ref={viewportRef}>
      <div
        className="cursor-masonry__rail"
        ref={railRef}
        style={{ '--masonry-columns': columnCount } as CSSProperties}
      >
        {columns.map((column, columnIndex) => {
          const firstSlot = column[0]
          const columnIsSwapping =
            Boolean(firstSlot) && activeSwap?.slotId === firstSlot.id

          return (
            <div
              className="cursor-masonry__column"
              data-column={columnIndex + 1}
              key={columnIndex}
            >
              <div
                className={`cursor-masonry__column-motion${columnIsSwapping ? ' is-swapping' : ''}`}
                onAnimationEnd={(event) =>
                  handleColumnAnimationEnd(event, firstSlot)
                }
              >
                {column.map((slot, rowIndex) => {
                  const pool = usablePool(slot)
                  const currentIndex =
                    currentIndexes[slot.id] ?? initialIndex(slot)
                  const currentImage = pool[currentIndex]
                  const currentSrc = sourceOf(currentImage)
                  const isFirstRow = rowIndex === 0
                  const isSwapping =
                    isFirstRow && activeSwap?.slotId === slot.id
                  const incomingImage = isSwapping
                    ? pool[activeSwap.nextIndex]
                    : currentImage
                  const incomingSrc = sourceOf(incomingImage)
                  const frameColor = isSwapping
                    ? activeSwap.frameColor
                    : transitionPalette[paletteIndex(currentImage, rowIndex)]

                  return (
                    <Link
                      className={`masonry-card masonry-card-${((slots.indexOf(slot) % 7) + 1)}`}
                      data-first-row={isFirstRow ? 'true' : undefined}
                      href={`/work/${slot.photoshootSlug}`}
                      key={slot.id}
                    >
                      <figure className="image-frame">
                        {isFirstRow && currentSrc ? (
                          <div
                            className={`gallery-stage${isSwapping ? ' is-swapping' : ''}`}
                            style={{ '--frame-color': frameColor } as CSSProperties}
                          >
                            <span
                              className="gallery-stage__color"
                              aria-hidden="true"
                            />
                            <Image
                              src={currentSrc}
                              alt={
                                currentImage?.alt ||
                                `${slot.photoshootTitle} portfolio image`
                              }
                              fill
                              priority={columnIndex < 4}
                              sizes="(max-width: 700px) 50vw, (max-width: 1100px) 50vw, 33vw"
                              className="gallery-stage__outgoing"
                            />
                            {incomingSrc ? (
                              <Image
                                src={incomingSrc}
                                alt=""
                                fill
                                sizes="(max-width: 700px) 50vw, (max-width: 1100px) 50vw, 33vw"
                                className="gallery-stage__incoming"
                                aria-hidden="true"
                              />
                            ) : null}
                          </div>
                        ) : currentSrc ? (
                          <Image
                            src={currentSrc}
                            alt={
                              currentImage?.alt ||
                              `${slot.photoshootTitle} portfolio image`
                            }
                            fill
                            sizes="(max-width: 700px) 50vw, (max-width: 1100px) 50vw, 33vw"
                            className="gallery-static-image"
                          />
                        ) : (
                          <div
                            className="visual-placeholder"
                            role="img"
                            aria-label={`${slot.photoshootTitle} portfolio image`}
                          />
                        )}
                      </figure>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
