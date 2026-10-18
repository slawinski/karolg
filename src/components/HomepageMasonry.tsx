'use client'

import Image from 'next/image'
import Link from 'next/link'
import { mediaRevision } from '@/lib/media-revision'
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
  type ActiveMediaSwap,
  arrangeSlotsInColumns,
  columnsForWidth,
  commitActiveSwap,
  createActiveSwap,
  clearFailedCandidates,
  type HomepageMasonrySlot,
  type HomepageMediaPool,
  type HomepageWaveDirection,
  initialIndexForSlot,
  scheduleNextSwap,
  recordFailedCandidate,
  type ScheduledMediaSwap,
  shouldResetSchedulerTopology,
  topRowSlotsForWave,
  type SwapSchedulerState,
  transitionColorOf,
} from '@/lib/homepage'
import {
  inferMediaKind,
  mediaDimensions,
  mediaPosterUrl,
  mediaPresentationUrl,
  type MediaLike,
} from '@/lib/media'
import { useDeferredVideoSource } from './useDeferredVideoSource'
import { usePublicMediaReady } from './PublicMediaReadiness'

const galleryMotion = {
  totalMs: 1500,
  initialDelayMs: 6000,
  betweenCyclesMs: 7000,
  preloadTimeoutMs: 5000,
  waveStaggerMs: 240,
} as const

const homepageCardSizes =
  '(max-width: 700px) calc(50vw - 4px), (hover: hover) and (pointer: fine) and (max-width: 1100px) calc((150vw - clamp(12px, 1.5vw, 24px) * 2) / 3), (max-width: 1100px) calc((125vw - clamp(12px, 1.5vw, 24px) * 2) / 3), calc((125vw - clamp(12px, 1.5vw, 24px) * 4) / 5)'

const waveDirections: readonly HomepageWaveDirection[] = [
  'left-to-right',
  'right-to-left',
  'middle-out',
]

type ActiveMediaSwaps = Record<string, ActiveMediaSwap>
type WaveCandidate = {
  identity: string
  swap: ActiveMediaSwap
  scheduled: ScheduledMediaSwap
  status: 'pending' | 'ready' | 'failed'
  phase: 'preparing' | 'queued' | 'active'
}
type Wave = {
  generation: number
  candidates: WaveCandidate[]
  finalized: boolean
  launched: boolean
  deadline?: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const sourceOf = (image: HomepageMediaPool['media'][number] | undefined) =>
  mediaPresentationUrl(image)

type HomepageVideoProps = {
  active: boolean
  alt: string
  className: string
  media: MediaLike
  hidden?: boolean
  preparing?: boolean
  onReady?: () => void
  onError?: () => void
}

export function HomepageVideo({
  active,
  alt,
  className,
  media,
  hidden = false,
  preparing = false,
  onReady,
  onError,
}: HomepageVideoProps) {
  const ref = useRef<HTMLVideoElement>(null)
  const src = mediaPresentationUrl(media) || undefined
  const { attachedSrc, playing } = useDeferredVideoSource(ref, src, preparing, active)

  useEffect(() => {
    const video = ref.current
    if (video && attachedSrc && video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      onReady?.()
    }
  }, [onReady, attachedSrc])

  return (
    <video
      ref={ref}
      src={attachedSrc}
      aria-label={hidden ? undefined : alt}
      aria-hidden={hidden || undefined}
      className={className}
      style={preparing ? undefined : { opacity: playing ? 1 : 0 }}
      loop
      muted
      playsInline
      preload={attachedSrc ? preparing ? 'auto' : 'metadata' : 'none'}
      onCanPlay={onReady}
      onError={onError}
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
  eager?: boolean
  hidden?: boolean
  preparing?: boolean
  onReady?: () => void
  onError?: () => void
}

function HomepageVisual({
  active,
  alt,
  className,
  media,
  eager = false,
  hidden = false,
  preparing = false,
  onReady,
  onError,
}: HomepageVisualProps) {
  const src = mediaPresentationUrl(media)
  if (!src) return null

  if (inferMediaKind(media) === 'video') {
    const poster = mediaPosterUrl(media)
    return (
      <>
        {poster && !hidden ? (
          <Image
            src={poster}
            unoptimized={mediaRevision(media.processingRevision) === null}
            alt=""
            aria-hidden="true"
            fill
            loading={eager || preparing ? 'eager' : 'lazy'}
            fetchPriority={eager ? 'high' : undefined}
            data-public-critical={eager || undefined}
            sizes={homepageCardSizes}
            className="media-poster"
            onError={(event) => { event.currentTarget.style.display = 'none' }}
            onLoad={(event) => { event.currentTarget.style.display = '' }}
          />
        ) : null}
        <HomepageVideo
          active={active}
          alt={alt}
          className={className}
          hidden={hidden}
          media={media}
          preparing={preparing}
          onReady={onReady}
          onError={onError}
        />
      </>
    )
  }

  return (
    <Image
      src={src}
      unoptimized={mediaRevision(media.processingRevision) === null}
      alt={hidden ? '' : alt}
      aria-hidden={hidden || undefined}
      fill
      loading={eager || preparing ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      data-public-critical={eager || undefined}
      onLoad={onReady}
      onError={onError}
      sizes={homepageCardSizes}
      className={className}
    />
  )
}

type HomepageMasonryProps = {
  pools: HomepageMediaPool[]
  slots: HomepageMasonrySlot[]
}

export function HomepageMasonry({ pools, slots }: HomepageMasonryProps) {
  const mediaReady = usePublicMediaReady()
  const viewportRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const currentIndexesRef = useRef<Record<string, number>>({})
  const activeSwapsRef = useRef<ActiveMediaSwaps>({})
  const pendingWaveSwapsRef = useRef(0)
  const waveLaunchCompleteRef = useRef(false)
  const generationRef = useRef(0)
  const waveRef = useRef<Wave | null>(null)
  const eligibleRef = useRef(false)
  const columnsRef = useRef(5)
  const cancelWaveRef = useRef<() => void>(() => {})
  const settleCandidateRef = useRef<(identity: string, ready: boolean) => void>(() => {})
  const previousTopologyRef = useRef<string | null>(null)
  const schedulerStateRef = useRef<SwapSchedulerState>({
    poolCursor: 0,
    slotCursors: {},
    failedCandidates: {},
  })

  const [columnCount, setColumnCount] = useState(5)
  const [currentIndexes, setCurrentIndexes] = useState<Record<string, number>>({})
  const [activeSwaps, setActiveSwaps] = useState<ActiveMediaSwaps>({})
  const [incoming, setIncoming] = useState<Record<string, WaveCandidate>>({})
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
  const topRowSlotIds = useMemo(
    () => new Set(columns.flatMap((column) => column[0]?.id || [])),
    [columns],
  )

  useEffect(() => {
    currentIndexesRef.current = currentIndexes
  }, [currentIndexes])

  useEffect(() => {
    const shouldReset = shouldResetSchedulerTopology(
      previousTopologyRef.current,
      topologyKey,
    )
    previousTopologyRef.current = topologyKey
    if (!shouldReset) return

    generationRef.current += 1
    if (waveRef.current) window.clearTimeout(waveRef.current.deadline)
    waveRef.current = null
    setIncoming({})
    currentIndexesRef.current = {}
    activeSwapsRef.current = {}
    pendingWaveSwapsRef.current = 0
    waveLaunchCompleteRef.current = false
    schedulerStateRef.current = {
      poolCursor: 0,
      slotCursors: {},
      failedCandidates: {},
    }
    setCurrentIndexes({})
    setActiveSwaps({})
    setCycle((value) => value + 1)
  }, [topologyKey])

  useEffect(() => {
    const updateColumns = () => {
      const next = columnsForWidth(window.innerWidth)
      if (next !== columnsRef.current) {
        cancelWaveRef.current()
        columnsRef.current = next
      }
      setColumnCount(next)
    }

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

      const eligible = mediaReady && (titleVisible || firstRowVisible) && pageVisible && !reduced
      eligibleRef.current = eligible
      if (!eligible) cancelWaveRef.current()
      setHeroEligible(eligible)
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
  }, [columnCount, topologyKey, mediaReady])

  const settleActiveWave = useCallback((commitIncoming = true) => {
    generationRef.current += 1
    const wave = waveRef.current
    if (wave) window.clearTimeout(wave.deadline)
    waveRef.current = null
    const active = Object.values(activeSwapsRef.current)
    const hadWave = wave?.launched

    if (commitIncoming && active.length) {
      setCurrentIndexes((current) => {
        const next = active.reduce(
          (indexes, swap) => commitActiveSwap(indexes, swap),
          current,
        )
        currentIndexesRef.current = next
        return next
      })
    }

    if (active.length) activeSwapsRef.current = {}
    pendingWaveSwapsRef.current = 0
    waveLaunchCompleteRef.current = false
    setActiveSwaps((current) => Object.keys(current).length ? {} : current)
    setIncoming((current) => Object.keys(current).length ? {} : current)
    if (hadWave) setCycle((value) => value + 1)
  }, [])
  cancelWaveRef.current = settleActiveWave

  useEffect(() => {
    if (heroEligible) return

    settleActiveWave(true)
  }, [heroEligible, settleActiveWave])

  useEffect(() => {
    // A responsive column-count change can redefine which cards are first-row cards.
    // Always settle before allowing the scheduler to use the new topology.
    settleActiveWave(true)
  }, [columnCount, settleActiveWave])

  useEffect(() => {
    if (!heroEligible) return

    const generation = ++generationRef.current
    const delay =
      cycle === 0 ? galleryMotion.initialDelayMs : galleryMotion.betweenCyclesMs
    const launchTimers = new Set<number>()
    const isCurrent = () => generation === generationRef.current &&
      eligibleRef.current && columnsRef.current === columnCount
    const publish = (wave: Wave) => setIncoming(Object.fromEntries(
      wave.candidates.map((candidate) => [candidate.swap.slotId, { ...candidate }]),
    ))

    const finalize = (wave: Wave) => {
      if (!isCurrent() || wave.finalized ||
        wave.candidates.some((candidate) => candidate.status === 'pending')) return
      wave.finalized = true
      window.clearTimeout(wave.deadline)

      const failedPools = new Set<string>()
      wave.candidates = wave.candidates.filter((candidate) => {
        if (candidate.status === 'failed') {
          failedPools.add(candidate.scheduled.poolId)
          schedulerStateRef.current = recordFailedCandidate(
            schedulerStateRef.current, candidate.scheduled,
          )
          return false
        }
        if (failedPools.has(candidate.scheduled.poolId)) return false
        schedulerStateRef.current = clearFailedCandidates(
          schedulerStateRef.current, candidate.scheduled,
        )
        candidate.phase = 'queued'
        return true
      })
      publish(wave)
      if (!wave.candidates.length) {
        waveRef.current = null
        setCycle((value) => value + 1)
        return
      }

      pendingWaveSwapsRef.current = wave.candidates.length
      waveLaunchCompleteRef.current = false
      const participantCount = wave.candidates.length
      wave.candidates.forEach((candidate, index) => {
        const launch = () => {
          if (!isCurrent() || waveRef.current !== wave) return
          wave.launched = true
          candidate.phase = 'active'
          const swap = candidate.swap
          const next = { ...activeSwapsRef.current, [swap.slotId]: swap }
          activeSwapsRef.current = next
          setActiveSwaps(next)
          publish(wave)
          if (index === participantCount - 1) waveLaunchCompleteRef.current = true
        }
        if (index === 0) launch()
        else launchTimers.add(window.setTimeout(launch, index * galleryMotion.waveStaggerMs))
      })
    }

    settleCandidateRef.current = (identity, ready) => {
      const wave = waveRef.current
      if (!wave || !isCurrent() || wave.finalized) return
      const candidate = wave.candidates.find((item) => item.identity === identity)
      if (!candidate || candidate.status !== 'pending') return
      candidate.status = ready ? 'ready' : 'failed'
      finalize(wave)
    }

    const timer = window.setTimeout(() => {
      const direction = waveDirections[cycle % waveDirections.length]
      const waveSlots = topRowSlotsForWave(slots, columnCount, direction)

      if (!isCurrent()) return
      const plannedSwaps: WaveCandidate[] = []
      let provisionalIndexes = { ...currentIndexesRef.current }

      for (const slot of waveSlots) {
        const scheduled = scheduleNextSwap({
          pools: usablePools,
          slots,
          currentIndexes: provisionalIndexes,
          schedulerState: schedulerStateRef.current,
          eligibleSlotIds: new Set([slot.id]),
        })
        schedulerStateRef.current = scheduled.schedulerState

        if (!scheduled.swap) continue

        const pool = poolsById.get(scheduled.swap.poolId)
        if (!pool) continue
        if (!sourceOf(pool.media[scheduled.swap.nextIndex])) continue

        const preparedSwap = createActiveSwap(scheduled.swap, pool)
        plannedSwaps.push({
          identity: `${generation}:${slot.id}:${scheduled.swap.poolId}:${scheduled.swap.nextIndex}`,
          swap: preparedSwap,
          scheduled: scheduled.swap,
          status: 'pending',
          phase: 'preparing',
        })
        provisionalIndexes = commitActiveSwap(provisionalIndexes, preparedSwap)
      }

      if (!plannedSwaps.length) {
        setCycle((value) => value + 1)
        return
      }

      const wave: Wave = {
        generation, candidates: plannedSwaps, finalized: false, launched: false,
      }
      // Register authority before publishing nodes: cached media can settle on mount.
      waveRef.current = wave
      wave.deadline = window.setTimeout(() => {
        if (!isCurrent()) return
        wave.candidates.forEach((candidate) => {
          if (candidate.status === 'pending') candidate.status = 'failed'
        })
        finalize(wave)
      }, galleryMotion.preloadTimeoutMs)
      publish(wave)
    }, delay)

    return () => {
      window.clearTimeout(timer)
      launchTimers.forEach((launchTimer) => window.clearTimeout(launchTimer))
      generationRef.current += 1
      if (waveRef.current?.generation === generation) {
        settleActiveWave(true)
      }
    }
  }, [columnCount, cycle, heroEligible, poolsById, slots, usablePools, settleActiveWave])

  const settleActiveSwap = useCallback((slotId: string) => {
    const wave = waveRef.current
    if (!wave || wave.generation !== generationRef.current || !eligibleRef.current) return
    const active = activeSwapsRef.current[slotId]
    if (!active) return

    setCurrentIndexes((current) => {
      const next = commitActiveSwap(current, active)
      currentIndexesRef.current = next
      return next
    })

    const next = { ...activeSwapsRef.current }
    delete next[slotId]
    activeSwapsRef.current = next
    setActiveSwaps(next)
    wave.candidates = wave.candidates.filter((candidate) => candidate.swap.slotId !== slotId)
    setIncoming((current) => {
      const remaining = { ...current }
      delete remaining[slotId]
      return remaining
    })
    pendingWaveSwapsRef.current = Math.max(0, pendingWaveSwapsRef.current - 1)

    if (pendingWaveSwapsRef.current === 0 && waveLaunchCompleteRef.current) {
      waveLaunchCompleteRef.current = false
      waveRef.current = null
      setCycle((value) => value + 1)
    }
  }, [])

  const handleColumnAnimationEnd = (
    event: AnimationEvent<HTMLDivElement>,
    column: HomepageMasonrySlot[],
  ) => {
    const activeSlotId = column.find(
      (slot) => activeSwapsRef.current[slot.id],
    )?.id

    if (
      event.target !== event.currentTarget ||
      event.animationName !== 'gallery-column-move' ||
      !activeSlotId ||
      !column.some((slot) => slot.id === activeSlotId)
    ) {
      return
    }

    settleActiveSwap(activeSlotId)
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
            (slot) => topRowSlotIds.has(slot.id) && Boolean(activeSwaps[slot.id]),
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
                  const activeSwap = topRowSlotIds.has(slot.id)
                    ? activeSwaps[slot.id]
                    : undefined
                  const isSwapping = Boolean(activeSwap)
                  const candidate = topRowSlotIds.has(slot.id) ? incoming[slot.id] : undefined
                  const incomingMedia = candidate ? pool.media[candidate.swap.nextIndex] : undefined
                  const incomingSrc = sourceOf(incomingMedia)
                  const frameColor = isSwapping
                    ? activeSwap!.frameColor
                    : transitionColorOf(currentMedia)
                  const alt = currentMedia?.alt ||
                    `${pool.photoshootTitle} portfolio ${inferMediaKind(currentMedia)}`
                  const isVideo = inferMediaKind(currentMedia) === 'video'
                  // A slot's frame belongs to the opening composition, not the
                  // currently rotating asset. Keep subsequent rows stationary.
                  const dimensions = mediaDimensions(pool.media[initialIndexForSlot(slot, pool.media.length)])

                  return (
                    <article
                      className={`masonry-card masonry-card-${((slots.indexOf(slot) % 7) + 1)}`}
                      data-first-row={isFirstRow ? 'true' : undefined}
                      data-slot={slot.id}
                      key={slot.id}
                    >
                      <figure
                        className="image-frame"
                        style={dimensions
                          ? { aspectRatio: `${dimensions.width} / ${dimensions.height}` }
                          : undefined}
                      >
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
                              eager={slots.indexOf(slot) < 2}
                              className="gallery-stage__outgoing"
                            />
                            {candidate && incomingSrc ? (
                              <HomepageVisual
                                key={candidate.identity}
                                active={false}
                                alt={`${pool.photoshootTitle} portfolio ${inferMediaKind(incomingMedia)}`}
                                media={incomingMedia!}
                                className="gallery-stage__incoming"
                                preparing
                                onReady={() => settleCandidateRef.current(candidate.identity, true)}
                                onError={() => settleCandidateRef.current(candidate.identity, false)}
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
