import type { MediaLike, PhotoshootLike } from './portfolio'
import { isUsableMedia, mediaPresentationUrl, mediaPosterUrl } from './media'

export type RandomSource = () => number

export type HomepageMediaPool = {
  id: string
  photoshootSlug: string
  photoshootTitle: string
  media: MediaLike[]
}

export type HomepageMasonrySlot = {
  id: string
  poolId: string
  initialMediaIndex: number
}

export type HomepageComposition = {
  pools: HomepageMediaPool[]
  slots: HomepageMasonrySlot[]
}

/** Normalize identities before discarding CMS-only fields at the client boundary. */
export function compactHomepage(composition: HomepageComposition): HomepageComposition {
  return {
    ...composition,
    pools: composition.pools.map((pool) => ({
      ...pool,
      media: pool.media.map((item) => {
        const url = mediaPresentationUrl(item)
        return {
          id: item.id, kind: item.kind, alt: item.alt,
          url, playbackUrl: item.playbackUrl ? url : undefined,
          posterUrl: mediaPosterUrl(item), playbackFilename: item.playbackFilename,
          posterFilename: item.posterFilename, processingRevision: item.processingRevision,
          width: item.width, height: item.height, videoWidth: item.videoWidth, videoHeight: item.videoHeight,
          posterWidth: item.posterWidth, posterHeight: item.posterHeight, transitionColor: item.transitionColor,
        }
      }),
    })),
  }
}

export type ActiveMediaSwap = {
  slotId: string
  nextIndex: number
  frameColor: string
}

export type ScheduledMediaSwap = {
  slotId: string
  poolId: string
  currentIndex: number
  nextIndex: number
}

export type SwapSchedulerState = {
  poolCursor: number
  slotCursors: Record<string, number>
  failedCandidates: Record<string, number[]>
}

export const FALLBACK_TRANSITION_COLOR = '#b8afa5'

export const shouldResetSchedulerTopology = (
  previousTopology: string | null,
  nextTopology: string,
) => previousTopology !== null && previousTopology !== nextTopology

const sourceOf = (media: MediaLike) => mediaPresentationUrl(media)

const photoshootKey = (photoshoot: PhotoshootLike) =>
  photoshoot.id == null
    ? `slug:${photoshoot.slug}`
    : `id:${String(photoshoot.id)}`

const mediaKey = (media: MediaLike) => {
  if (media.id != null) return `id:${String(media.id)}`
  if (sourceOf(media)) return `url:${sourceOf(media)}`
  if (media.filename) return `filename:${media.filename}`
  return null
}

const randomUnit = (random: RandomSource) => {
  const value = random()
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(value, 0), 1 - Number.EPSILON)
}

const randomIndex = (length: number, random: RandomSource) =>
  Math.floor(randomUnit(random) * length)

export function sampleWithoutReplacement<T>(
  values: readonly T[],
  count: number,
  random: RandomSource,
) {
  const available = [...values]
  const sampleSize = Math.min(Math.max(0, count), available.length)

  for (let index = 0; index < sampleSize; index += 1) {
    const selectedIndex = index + randomIndex(available.length - index, random)
    const selected = available[selectedIndex]
    available[selectedIndex] = available[index]
    available[index] = selected
  }

  return available.slice(0, sampleSize)
}

function initialMediaCount(poolSize: number, random: RandomSource) {
  if (poolSize <= 4) return poolSize
  return randomUnit(random) < 0.5 ? 4 : 5
}

function interleaveSlots(
  slotsByPool: Map<string, HomepageMasonrySlot[]>,
  random: RandomSource,
) {
  const interleaved: HomepageMasonrySlot[] = []
  let previousPoolId: string | null = null

  while (true) {
    const remainingPoolIds = Array.from(slotsByPool.entries())
      .filter(([, slots]) => slots.length > 0)
      .map(([poolId]) => poolId)

    if (!remainingPoolIds.length) return interleaved

    const alternatives = remainingPoolIds.filter(
      (poolId) => poolId !== previousPoolId,
    )
    const eligiblePoolIds = alternatives.length ? alternatives : remainingPoolIds
    const largestRemainingCount = Math.max(
      ...eligiblePoolIds.map((poolId) => slotsByPool.get(poolId)?.length || 0),
    )
    const balancedPoolIds = eligiblePoolIds.filter(
      (poolId) => slotsByPool.get(poolId)?.length === largestRemainingCount,
    )
    const poolId = balancedPoolIds[randomIndex(balancedPoolIds.length, random)]
    const nextSlot = slotsByPool.get(poolId)?.shift()

    if (nextSlot) {
      interleaved.push(nextSlot)
      previousPoolId = poolId
    }
  }
}

export function composeHomepage(
  photoshoots: readonly PhotoshootLike[],
  media: readonly MediaLike[],
  random: RandomSource = Math.random,
): HomepageComposition {
  const poolsById = new Map<string, HomepageMediaPool>()
  const seenMediaByPool = new Map<string, Set<string>>()

  for (const photoshoot of photoshoots) {
    const id = photoshootKey(photoshoot)
    poolsById.set(id, {
      id,
      photoshootSlug: photoshoot.slug,
      photoshootTitle: photoshoot.title,
      media: [],
    })
    seenMediaByPool.set(id, new Set())
  }

  for (const item of media) {
    if (!isUsableMedia(item) || item.photoshoot == null) continue

    const poolId =
      typeof item.photoshoot === 'object'
        ? photoshootKey(item.photoshoot)
        : `id:${String(item.photoshoot)}`
    const pool = poolsById.get(poolId)
    const key = mediaKey(item)
    const seen = seenMediaByPool.get(poolId)

    if (!pool || !key || !seen || seen.has(key)) continue

    seen.add(key)
    pool.media.push(item)
  }

  const pools = Array.from(poolsById.values()).filter(
    (pool) => pool.media.length > 0,
  )
  const slotsByPool = new Map<string, HomepageMasonrySlot[]>()

  for (const pool of pools) {
    const indexes = pool.media.map((_, index) => index)
    const selectedIndexes = sampleWithoutReplacement(
      indexes,
      initialMediaCount(indexes.length, random),
      random,
    )

    slotsByPool.set(
      pool.id,
      selectedIndexes.map((initialMediaIndex) => ({
        id: `${pool.id}:media:${initialMediaIndex}`,
        poolId: pool.id,
        initialMediaIndex,
      })),
    )
  }

  return {
    pools,
    slots: interleaveSlots(slotsByPool, random),
  }
}

type MediaCandidateSelection = {
  poolSize: number
  currentIndex: number
  assignedIndexes: readonly number[]
  excludedIndexes?: ReadonlySet<number>
}

export function selectNextMediaIndex({
  poolSize,
  currentIndex,
  assignedIndexes,
  excludedIndexes = new Set(),
}: MediaCandidateSelection) {
  if (poolSize <= 1) return null

  const normalizedCurrent = ((currentIndex % poolSize) + poolSize) % poolSize
  const validAssignments = assignedIndexes.filter(
    (index) => index >= 0 && index < poolSize,
  )
  const activeAssignmentIndex = validAssignments.indexOf(normalizedCurrent)
  const siblingIndexes = [...validAssignments]

  if (activeAssignmentIndex >= 0) {
    siblingIndexes.splice(activeAssignmentIndex, 1)
  }

  const visibleDiversity = new Set(
    activeAssignmentIndex >= 0
      ? validAssignments
      : [...validAssignments, normalizedCurrent],
  ).size
  const siblingCounts = new Map<number, number>()

  for (const index of siblingIndexes) {
    siblingCounts.set(index, (siblingCounts.get(index) || 0) + 1)
  }

  const candidates = Array.from(
    { length: poolSize - 1 },
    (_, offset) => (normalizedCurrent + offset + 1) % poolSize,
  )
  const legalCandidates = candidates.filter(
    (candidate) =>
      !excludedIndexes.has(candidate) &&
      new Set([...siblingIndexes, candidate]).size >= visibleDiversity,
  )

  if (!legalCandidates.length) return null

  const leastRepresentedCount = Math.min(
    ...legalCandidates.map((index) => siblingCounts.get(index) || 0),
  )

  return legalCandidates.find(
    (index) => (siblingCounts.get(index) || 0) === leastRepresentedCount,
  ) ?? null
}

export const initialIndexForSlot = (
  slot: HomepageMasonrySlot,
  poolSize: number,
) => poolSize ? slot.initialMediaIndex % poolSize : 0

const indexForSlot = (
  slot: HomepageMasonrySlot,
  poolSize: number,
  currentIndexes: Readonly<Record<string, number>>,
) => currentIndexes[slot.id] ?? initialIndexForSlot(slot, poolSize)

type ScheduleNextSwap = {
  pools: readonly HomepageMediaPool[]
  slots: readonly HomepageMasonrySlot[]
  currentIndexes: Readonly<Record<string, number>>
  schedulerState: SwapSchedulerState
  eligibleSlotIds?: ReadonlySet<string>
}

const failureKey = (poolId: string, slotId: string) => `${poolId}:${slotId}`

export function recordFailedCandidate(
  state: SwapSchedulerState,
  swap: ScheduledMediaSwap,
): SwapSchedulerState {
  const key = failureKey(swap.poolId, swap.slotId)
  const failed = new Set(state.failedCandidates[key] || [])
  failed.add(swap.nextIndex)
  return {
    ...state,
    failedCandidates: { ...state.failedCandidates, [key]: Array.from(failed) },
  }
}

export function clearFailedCandidates(
  state: SwapSchedulerState,
  swap: Pick<ScheduledMediaSwap, 'poolId' | 'slotId'>,
): SwapSchedulerState {
  const key = failureKey(swap.poolId, swap.slotId)
  if (!(key in state.failedCandidates)) return state
  const failedCandidates = { ...state.failedCandidates }
  delete failedCandidates[key]
  return { ...state, failedCandidates }
}

export function scheduleNextSwap({
  pools,
  slots,
  currentIndexes,
  schedulerState,
  eligibleSlotIds,
}: ScheduleNextSwap): {
  swap: ScheduledMediaSwap | null
  schedulerState: SwapSchedulerState
} {
  if (!pools.length) return { swap: null, schedulerState }

  for (let poolOffset = 0; poolOffset < pools.length; poolOffset += 1) {
    const poolIndex = (schedulerState.poolCursor + poolOffset) % pools.length
    const pool = pools[poolIndex]
    const poolSize = pool.media.length
    const poolSlots = slots.filter((slot) => slot.poolId === pool.id)
    const eligiblePoolSlots = eligibleSlotIds
      ? poolSlots.filter((slot) => eligibleSlotIds.has(slot.id))
      : poolSlots

    if (poolSize <= 1 || !eligiblePoolSlots.length) continue

    const assignedIndexes = poolSlots.map((slot) =>
      indexForSlot(slot, poolSize, currentIndexes),
    )
    const assignmentCounts = new Map<number, number>()

    for (const index of assignedIndexes) {
      assignmentCounts.set(index, (assignmentCounts.get(index) || 0) + 1)
    }

    const slotCursor = schedulerState.slotCursors[pool.id] || 0
    const orderedSlots = Array.from({ length: poolSlots.length }, (_, offset) =>
      poolSlots[(slotCursor + offset) % poolSlots.length],
    ).filter((slot) => !eligibleSlotIds || eligibleSlotIds.has(slot.id))
    const exhaustedFailureKeys = new Set<string>()
    const options = orderedSlots.flatMap((slot) => {
      const currentIndex = indexForSlot(slot, poolSize, currentIndexes)
      const key = failureKey(pool.id, slot.id)
      const excludedIndexes = new Set(schedulerState.failedCandidates[key] || [])
      let nextIndex = selectNextMediaIndex({
        poolSize,
        currentIndex,
        assignedIndexes,
        excludedIndexes,
      })
      if (nextIndex == null && excludedIndexes.size) {
        nextIndex = selectNextMediaIndex({
          poolSize,
          currentIndex,
          assignedIndexes,
        })
        exhaustedFailureKeys.add(key)
      }

      return nextIndex == null ? [] : [{ slot, currentIndex, nextIndex }]
    })
    const duplicatedOptions = options.filter(
      ({ currentIndex }) => (assignmentCounts.get(currentIndex) || 0) > 1,
    )
    const option = (duplicatedOptions.length ? duplicatedOptions : options)[0]

    if (!option) continue

    const failedCandidates = { ...schedulerState.failedCandidates }
    exhaustedFailureKeys.forEach((key) => delete failedCandidates[key])

    const selectedSlotIndex = poolSlots.findIndex(
      (slot) => slot.id === option.slot.id,
    )

    return {
      swap: {
        slotId: option.slot.id,
        poolId: pool.id,
        currentIndex: option.currentIndex,
        nextIndex: option.nextIndex,
      },
      schedulerState: {
        poolCursor: (poolIndex + 1) % pools.length,
        slotCursors: {
          ...schedulerState.slotCursors,
          [pool.id]: (selectedSlotIndex + 1) % poolSlots.length,
        },
        failedCandidates,
      },
    }
  }

  return { swap: null, schedulerState }
}

export const columnsForWidth = (width: number) => {
  if (width <= 700) return 2
  if (width <= 1100) return 3
  return 5
}

export const arrangeSlotsInColumns = (
  slots: readonly HomepageMasonrySlot[],
  columnCount: number,
) =>
  Array.from({ length: columnCount }, (_, columnIndex) =>
    slots.filter((_, slotIndex) => slotIndex % columnCount === columnIndex),
  )

export type HomepageWaveDirection =
  | 'left-to-right'
  | 'right-to-left'
  | 'middle-out'

export function topRowSlotsForWave(
  slots: readonly HomepageMasonrySlot[],
  columnCount: number,
  direction: HomepageWaveDirection,
) {
  const topRow = arrangeSlotsInColumns(slots, columnCount)
    .map((column) => column[0])
    .filter((slot): slot is HomepageMasonrySlot => Boolean(slot))

  if (direction === 'right-to-left') return topRow.reverse()
  if (direction === 'left-to-right') return topRow

  const ordered: HomepageMasonrySlot[] = []
  let left = Math.floor((topRow.length - 1) / 2)
  let right = Math.ceil((topRow.length - 1) / 2)

  if (left === right) {
    ordered.push(topRow[left])
    left -= 1
    right += 1
  }

  while (left >= 0 || right < topRow.length) {
    if (left >= 0) ordered.push(topRow[left])
    if (right < topRow.length) ordered.push(topRow[right])
    left -= 1
    right += 1
  }

  return ordered
}

export function normalizeTransitionColor(
  color: string | null | undefined,
): string {
  const normalized = color?.trim().toLowerCase()

  if (normalized && /^#[0-9a-f]{6}$/.test(normalized)) return normalized

  const shortColor = normalized?.match(/^#([0-9a-f]{3})$/)?.[1]
  if (shortColor) {
    return `#${Array.from(shortColor, (character) => character.repeat(2)).join('')}`
  }

  return FALLBACK_TRANSITION_COLOR
}

export function normalizeStoredTransitionColor(value: unknown) {
  if (typeof value !== 'string') return null

  const normalized = value.trim().toLowerCase()
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : null
}

export const transitionColorOf = (media: MediaLike | undefined) =>
  normalizeTransitionColor(media?.transitionColor)

export function createActiveSwap(
  swap: ScheduledMediaSwap,
  pool: HomepageMediaPool,
): ActiveMediaSwap {
  return {
    slotId: swap.slotId,
    nextIndex: swap.nextIndex,
    frameColor: transitionColorOf(pool.media[swap.currentIndex]),
  }
}

export function acceptReadySwap(
  swap: ActiveMediaSwap,
  decoded: boolean,
  requestGeneration: number,
  currentGeneration: number,
) {
  return decoded && requestGeneration === currentGeneration ? swap : null
}

export function commitActiveSwap(
  currentIndexes: Readonly<Record<string, number>>,
  activeSwap: ActiveMediaSwap | null,
) {
  return activeSwap
    ? { ...currentIndexes, [activeSwap.slotId]: activeSwap.nextIndex }
    : currentIndexes
}
