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
import {
  acceptReadySwap,
  type ActiveMediaSwap,
  arrangeSlotsInColumns,
  columnsForWidth,
  commitActiveSwap,
  createActiveSwap,
  clearFailedCandidates,
  type HomepageMasonrySlot,
  type HomepageMediaPool,
  initialIndexForSlot,
  scheduleNextSwap,
  recordFailedCandidate,
  shouldResetSchedulerTopology,
  type SwapSchedulerState,
  transitionColorOf,
} from '@/lib/homepage'
import {
  inferMediaKind,
  mediaPosterUrl,
  mediaPresentationUrl,
  readinessKindForMedia,
  type MediaLike,
} from '@/lib/media'

const galleryMotion = {
  totalMs: 1500,
  initialDelayMs: 6000,
  betweenCyclesMs: 7000,
  preloadTimeoutMs: 5000,
} as const

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const sourceOf = (image: HomepageMediaPool['media'][number] | undefined) =>
  mediaPresentationUrl(image)

const preloadUntilReady = (media: MediaLike, timeoutMs: number) =>
  new Promise<boolean>((resolve) => {
    const src = mediaPresentationUrl(media)
    if (!src) {
      resolve(false)
      return
    }

    if (readinessKindForMedia(media) === 'canplay') {
      const video = document.createElement('video')
      let settled = false
      const finish = (result: boolean) => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        video.removeAttribute('src')
        video.load()
        resolve(result)
      }
      const timeout = window.setTimeout(() => finish(false), timeoutMs)
      video.preload = 'metadata'
      video.muted = true
      video.oncanplay = () => finish(true)
      video.onerror = () => finish(false)
      video.src = src
      video.load()
      return
    }

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

type HomepageVideoProps = {
  active: boolean
  alt: string
  className: string
  media: MediaLike
  hidden?: boolean
}

export function HomepageVideo({
  active,
  alt,
  className,
  media,
  hidden = false,
}: HomepageVideoProps) {
  const ref = useRef<HTMLVideoElement>(null)
  const [visible, setVisible] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const video = ref.current
    if (!video) return

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.1),
      { threshold: [0, 0.1, 1] },
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateVisibility = () => setPageVisible(document.visibilityState === 'visible')
    const updateMotion = () => setReducedMotion(motion.matches)

    updateVisibility()
    updateMotion()
    document.addEventListener('visibilitychange', updateVisibility)
    motion.addEventListener('change', updateMotion)
    return () => {
      document.removeEventListener('visibilitychange', updateVisibility)
      motion.removeEventListener('change', updateMotion)
    }
  }, [])

  useEffect(() => {
    const video = ref.current
    if (!video) return

    if (active && visible && pageVisible && !reducedMotion) {
      void video.play().catch(() => undefined)
    } else {
      video.pause()
    }
  }, [active, pageVisible, reducedMotion, visible])

  return (
    <video
      ref={ref}
      src={mediaPresentationUrl(media) || undefined}
      poster={mediaPosterUrl(media) || undefined}
      aria-label={hidden ? undefined : alt}
      aria-hidden={hidden || undefined}
      className={className}
      controls={reducedMotion}
      loop
      muted
      playsInline
      preload="metadata"
    >
      Your browser does not support video playback.
    </video>
  )
}

type HomepageVisualProps = {
  active: boolean
  alt: string
  className: string
  media: MediaLike
  priority?: boolean
  hidden?: boolean
}

function HomepageVisual({
  active,
  alt,
  className,
  media,
  priority = false,
  hidden = false,
}: HomepageVisualProps) {
  const src = mediaPresentationUrl(media)
  if (!src) return null

  if (inferMediaKind(media) === 'video') {
    return (
      <HomepageVideo
        active={active}
        alt={alt}
        className={className}
        hidden={hidden}
        media={media}
      />
    )
  }

  return (
    <Image
      src={src}
      alt={hidden ? '' : alt}
      aria-hidden={hidden || undefined}
      fill
      priority={priority}
      sizes="(max-width: 700px) 50vw, (max-width: 1100px) 50vw, 25vw"
      className={className}
    />
  )
}

type HomepageMasonryProps = {
  pools: HomepageMediaPool[]
  slots: HomepageMasonrySlot[]
}

export function HomepageMasonry({ pools, slots }: HomepageMasonryProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const currentIndexesRef = useRef<Record<string, number>>({})
  const activeSwapRef = useRef<ActiveMediaSwap | null>(null)
  const generationRef = useRef(0)
  const previousTopologyRef = useRef<string | null>(null)
  const schedulerStateRef = useRef<SwapSchedulerState>({
    poolCursor: 0,
    slotCursors: {},
    failedCandidates: {},
  })

  const [columnCount, setColumnCount] = useState(5)
  const [currentIndexes, setCurrentIndexes] = useState<Record<string, number>>({})
  const [activeSwap, setActiveSwap] = useState<ActiveMediaSwap | null>(null)
  const [heroEligible, setHeroEligible] = useState(false)
  const [cycle, setCycle] = useState(0)

  const usablePools = useMemo(
    () =>
      pools.map((pool) => ({
        ...pool,
        media: pool.media.filter((image) => Boolean(sourceOf(image))),
      })),
    [pools],
  )

  const poolsById = useMemo(
    () => new Map(usablePools.map((pool) => [pool.id, pool])),
    [usablePools],
  )

  const topologyKey = useMemo(
    () => JSON.stringify({
      pools: usablePools.map((pool) => ({
        id: pool.id,
        media: pool.media.map((item) => sourceOf(item)),
      })),
      slots: slots.map((slot) => [slot.id, slot.poolId, slot.initialMediaIndex]),
    }),
    [slots, usablePools],
  )

  const columns = useMemo(
    () => arrangeSlotsInColumns(slots, columnCount),
    [columnCount, slots],
  )

  useEffect(() => {
    currentIndexesRef.current = currentIndexes
  }, [currentIndexes])

  useEffect(() => {
    activeSwapRef.current = activeSwap
  }, [activeSwap])

  useEffect(() => {
    const shouldReset = shouldResetSchedulerTopology(
      previousTopologyRef.current,
      topologyKey,
    )
    previousTopologyRef.current = topologyKey
    if (!shouldReset) return

    generationRef.current += 1
    currentIndexesRef.current = {}
    activeSwapRef.current = null
    schedulerStateRef.current = {
      poolCursor: 0,
      slotCursors: {},
      failedCandidates: {},
    }
    setCurrentIndexes({})
    setActiveSwap(null)
    setCycle((value) => value + 1)
  }, [topologyKey])

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
    let returningToCenter = false

    const apply = () => {
      const overflow = Math.max(0, rail.scrollWidth - viewport.clientWidth)
      rail.style.transform = `translate3d(${-overflow * current}px, 0, 0)`
    }

    const tick = () => {
      animationFrame = 0

      const easing = returningToCenter ? 0.045 : 0.14
      current += (target - current) * easing
      apply()

      if (Math.abs(target - current) > 0.00015) {
        animationFrame = window.requestAnimationFrame(tick)
      } else {
        current = target
        returningToCenter = false
        apply()
      }
    }

    const animateToTarget = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(tick)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = viewport.getBoundingClientRect()
      returningToCenter = false
      target = clamp((event.clientX - bounds.left) / bounds.width, 0, 1)
      animateToTarget()
    }

    const handlePointerLeave = () => {
      returningToCenter = true
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
        const next = commitActiveSwap(current, active)
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

    const generation = ++generationRef.current
    const delay =
      cycle === 0 ? galleryMotion.initialDelayMs : galleryMotion.betweenCyclesMs

    const timer = window.setTimeout(() => {
      const scheduled = scheduleNextSwap({
        pools: usablePools,
        slots,
        currentIndexes: currentIndexesRef.current,
        schedulerState: schedulerStateRef.current,
      })
      schedulerStateRef.current = scheduled.schedulerState

      if (!scheduled.swap) return

      const pool = poolsById.get(scheduled.swap.poolId)
      if (!pool) return

      const nextMedia = pool.media[scheduled.swap.nextIndex]
      const nextSrc = sourceOf(nextMedia)

      if (!nextSrc) {
        setCycle((value) => value + 1)
        return
      }

      const preparedSwap = createActiveSwap(scheduled.swap, pool)

      void preloadUntilReady(nextMedia, galleryMotion.preloadTimeoutMs).then((decoded) => {
        const readySwap = acceptReadySwap(
          preparedSwap,
          decoded,
          generation,
          generationRef.current,
        )

        if (!readySwap) {
          if (generation === generationRef.current) {
            if (!decoded) {
              schedulerStateRef.current = recordFailedCandidate(
                schedulerStateRef.current,
                scheduled.swap!,
              )
              console.warn(`Homepage media preload failed: ${nextSrc}`)
            }
            setCycle((value) => value + 1)
          }
          return
        }

        schedulerStateRef.current = clearFailedCandidates(
          schedulerStateRef.current,
          scheduled.swap!,
        )
        activeSwapRef.current = readySwap
        setActiveSwap(readySwap)
      })
    }, delay)

    return () => {
      window.clearTimeout(timer)
      generationRef.current += 1
    }
  }, [activeSwap, columnCount, cycle, heroEligible, poolsById, slots, usablePools])

  const handleColumnAnimationEnd = (
    event: AnimationEvent<HTMLDivElement>,
    column: HomepageMasonrySlot[],
  ) => {
    const activeSlotId = activeSwapRef.current?.slotId

    if (
      event.target !== event.currentTarget ||
      event.animationName !== 'gallery-column-move' ||
      !activeSlotId ||
      !column.some((slot) => slot.id === activeSlotId)
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
          const columnIsSwapping = column.some(
            (slot) => activeSwap?.slotId === slot.id,
          )

          return (
            <div
              className="cursor-masonry__column"
              data-column={columnIndex + 1}
              key={columnIndex}
            >
              <div
                className={`cursor-masonry__column-motion${columnIsSwapping ? ' is-swapping' : ''}`}
                onAnimationEnd={(event) =>
                  handleColumnAnimationEnd(event, column)
                }
              >
                {column.map((slot, rowIndex) => {
                  const pool = poolsById.get(slot.poolId)
                  if (!pool) return null

                  const currentIndex =
                    currentIndexes[slot.id] ??
                    initialIndexForSlot(slot, pool.media.length)
                  const currentMedia = pool.media[currentIndex]
                  const currentSrc = sourceOf(currentMedia)
                  const isFirstRow = rowIndex === 0
                  const isSwapping = activeSwap?.slotId === slot.id
                  const incomingMedia = isSwapping
                    ? pool.media[activeSwap.nextIndex]
                    : currentMedia
                  const incomingSrc = sourceOf(incomingMedia)
                  const frameColor = isSwapping
                    ? activeSwap.frameColor
                    : transitionColorOf(currentMedia)
                  const alt = currentMedia?.alt ||
                    `${pool.photoshootTitle} portfolio ${inferMediaKind(currentMedia)}`
                  const isVideo = inferMediaKind(currentMedia) === 'video'

                  return (
                    <article
                      className={`masonry-card masonry-card-${((slots.indexOf(slot) % 7) + 1)}`}
                      data-first-row={isFirstRow ? 'true' : undefined}
                      key={slot.id}
                    >
                      <figure className="image-frame">
                        {(isFirstRow || isSwapping) && currentSrc ? (
                          <div
                            className={`gallery-stage${isSwapping ? ' is-swapping' : ''}`}
                            style={{ '--frame-color': frameColor } as CSSProperties}
                          >
                            <span
                              className="gallery-stage__color"
                              aria-hidden="true"
                            />
                            <HomepageVisual
                              active={!isSwapping}
                              alt={alt}
                              media={currentMedia}
                              priority={columnIndex < 4}
                              className="gallery-stage__outgoing"
                            />
                            {incomingSrc ? (
                              <HomepageVisual
                                active={false}
                                alt={`${pool.photoshootTitle} portfolio ${inferMediaKind(incomingMedia)}`}
                                media={incomingMedia}
                                className="gallery-stage__incoming"
                                hidden
                              />
                            ) : null}
                          </div>
                        ) : currentSrc ? (
                          <HomepageVisual
                            active
                            alt={alt}
                            media={currentMedia}
                            className="gallery-static-image"
                          />
                        ) : (
                          <div
                            className="visual-placeholder"
                            role="img"
                            aria-label={`${pool.photoshootTitle} portfolio image`}
                          />
                        )}
                      </figure>
                      <Link
                        className={`masonry-card__link${isVideo ? ' masonry-card__link--video' : ''}`}
                        href={`/work/${pool.photoshootSlug}`}
                      >
                        <span className={isVideo ? undefined : 'sr-only'}>
                          View {pool.photoshootTitle}
                        </span>
                      </Link>
                    </article>
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
