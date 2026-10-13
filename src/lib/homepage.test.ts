import { describe, expect, it } from 'vitest'
import type { MediaLike, PhotoshootLike } from './portfolio'
import {
  acceptReadySwap,
  arrangeSlotsInColumns,
  commitActiveSwap,
  FALLBACK_TRANSITION_COLOR,
  composeHomepage,
  createActiveSwap,
  type HomepageMasonrySlot,
  type HomepageMediaPool,
  normalizeTransitionColor,
  normalizeStoredTransitionColor,
  recordFailedCandidate,
  scheduleNextSwap,
  selectNextMediaIndex,
  shouldResetSchedulerTopology,
  type SwapSchedulerState,
  transitionColorOf,
} from './homepage'

const shoot = (id: number, title = `Shoot ${id}`): PhotoshootLike => ({
  id,
  title,
  slug: `shoot-${id}`,
})

const image = (
  id: number,
  photoshoot: PhotoshootLike,
  overrides: Partial<MediaLike> = {},
): MediaLike => ({
  id,
  url: `/media/${id}.jpg`,
  photoshoot,
  ...overrides,
})

const sequenceRandom = (...values: number[]) => {
  let index = 0
  return () => values[index++ % values.length]
}

const seededRandom = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}

describe('composeHomepage', () => {
  it('omits empty and unusable pools', () => {
    const photoshoot = shoot(1)
    const composition = composeHomepage(
      [photoshoot],
      [image(1, photoshoot, { url: null }), image(2, photoshoot, { url: ' ' })],
      () => 0,
    )

    expect(composition).toEqual({ pools: [], slots: [] })
  })

  it.each([1, 4])('selects all %i usable media items', (count) => {
    const photoshoot = shoot(1)
    const media = Array.from({ length: count }, (_, index) =>
      image(index + 1, photoshoot),
    )
    const composition = composeHomepage([photoshoot], media, () => 0)

    expect(composition.pools[0].media).toHaveLength(count)
    expect(composition.slots).toHaveLength(count)
    expect(new Set(composition.slots.map((slot) => slot.initialMediaIndex)).size)
      .toBe(count)
  })

  it('uses injected randomness to choose four or five distinct cards from five', () => {
    const photoshoot = shoot(1)
    const media = Array.from({ length: 5 }, (_, index) =>
      image(index + 1, photoshoot),
    )

    const four = composeHomepage([photoshoot], media, () => 0)
    const five = composeHomepage([photoshoot], media, () => 0.75)

    expect(four.slots).toHaveLength(4)
    expect(five.slots).toHaveLength(5)
    expect(new Set(five.slots.map((slot) => slot.initialMediaIndex)).size).toBe(5)
  })

  it('produces deterministic selections for the same seeded random source', () => {
    const photoshoot = shoot(1)
    const media = Array.from({ length: 8 }, (_, index) =>
      image(index + 1, photoshoot),
    )

    const first = composeHomepage([photoshoot], media, seededRandom(42))
    const second = composeHomepage([photoshoot], media, seededRandom(42))

    expect(first.slots).toEqual(second.slots)
  })

  it('retains a complete deduplicated pool while sampling more than five media', () => {
    const photoshoot = shoot(1)
    const media = Array.from({ length: 7 }, (_, index) =>
      image(index + 1, photoshoot),
    )
    media.push(image(7, photoshoot))

    const composition = composeHomepage(
      [photoshoot],
      media,
      sequenceRandom(0.75, 0.9, 0.8, 0.7, 0.6, 0.5),
    )

    expect(composition.pools[0].media).toHaveLength(7)
    expect(composition.slots).toHaveLength(5)
    expect(new Set(composition.slots.map((slot) => slot.initialMediaIndex)).size).toBe(5)
    expect(Math.max(...composition.slots.map((slot) => slot.initialMediaIndex)))
      .toBeGreaterThan(4)
  })

  it('interleaves photoshoots without adjacent cards when an alternative exists', () => {
    const first = shoot(1)
    const second = shoot(2)
    const media = [
      ...Array.from({ length: 4 }, (_, index) => image(index + 1, first)),
      ...Array.from({ length: 4 }, (_, index) => image(index + 10, second)),
    ]

    const { slots } = composeHomepage([first, second], media, () => 0)

    for (let index = 1; index < slots.length; index += 1) {
      expect(slots[index].poolId).not.toBe(slots[index - 1].poolId)
    }
  })

  it('accepts an unpopulated photoshoot relationship ID', () => {
    const photoshoot = shoot(1)
    const composition = composeHomepage(
      [photoshoot],
      [{ ...image(1, photoshoot), photoshoot: photoshoot.id }],
      () => 0,
    )

    expect(composition.pools[0].media).toHaveLength(1)
    expect(composition.slots).toHaveLength(1)
  })

  it('includes ready videos and excludes videos without ready derivatives', () => {
    const photoshoot = shoot(1)
    const readyVideo = image(1, photoshoot, {
      kind: 'video',
      mimeType: 'video/quicktime',
      processingStatus: 'ready',
      playbackFilename: 'generated/1/r1/playback.mp4',
      playbackUrl: '/media/ready.mp4',
      posterFilename: 'generated/1/r1/poster.jpg',
      posterUrl: '/media/ready.jpg',
    })
    const pendingVideo = {
      ...readyVideo,
      id: 2,
      processingStatus: 'pending' as const,
    }
    const unpublishedVideo = {
      ...pendingVideo,
      id: 3,
      playbackFilename: null,
      posterFilename: null,
    }

    const composition = composeHomepage(
      [photoshoot],
      [readyVideo, pendingVideo, unpublishedVideo],
      () => 0,
    )

    expect(composition.pools[0].media).toEqual([readyVideo, pendingVideo])
  })
})

describe('selectNextMediaIndex', () => {
  it('walks the pool in round-robin order for one slot', () => {
    let currentIndex = 0
    const visited: number[] = []

    for (let index = 0; index < 6; index += 1) {
      currentIndex = selectNextMediaIndex({
        poolSize: 6,
        currentIndex,
        assignedIndexes: [currentIndex],
      }) as number
      visited.push(currentIndex)
    }

    expect(visited).toEqual([1, 2, 3, 4, 5, 0])
  })

  it('excludes the slot own item and media visible in sibling slots', () => {
    expect(selectNextMediaIndex({
      poolSize: 5,
      currentIndex: 0,
      assignedIndexes: [0, 1, 2, 3],
    })).toBe(4)
  })

  it.each([
    { assignments: [0, 1], poolSize: 2, currentIndex: 0 },
    { assignments: [0, 1, 2, 3], poolSize: 4, currentIndex: 0 },
  ])('keeps a fully occupied distinct pool static: $assignments', ({
    assignments,
    poolSize,
    currentIndex,
  }) => {
    expect(selectNextMediaIndex({
      poolSize,
      currentIndex,
      assignedIndexes: assignments,
    })).toBeNull()
  })

  it('does not reduce diversity by swapping the singleton in [0, 1, 1]', () => {
    expect(selectNextMediaIndex({
      poolSize: 2,
      currentIndex: 0,
      assignedIndexes: [0, 1, 1],
    })).toBeNull()
  })

  it('allows a duplicated slot in [0, 1, 1] to swap without reducing diversity', () => {
    expect(selectNextMediaIndex({
      poolSize: 2,
      currentIndex: 1,
      assignedIndexes: [0, 1, 1],
    })).toBe(0)
  })

  it('chooses a finite least-represented non-current item for insufficient pools', () => {
    expect(selectNextMediaIndex({
      poolSize: 3,
      currentIndex: 0,
      assignedIndexes: [0, 0, 1, 1, 2],
    })).toBe(2)
  })

  it('returns no candidate for pools with fewer than two items', () => {
    expect(selectNextMediaIndex({
      poolSize: 1,
      currentIndex: 0,
      assignedIndexes: [0],
    })).toBeNull()
    expect(selectNextMediaIndex({
      poolSize: 0,
      currentIndex: 0,
      assignedIndexes: [],
    })).toBeNull()
  })
})

const schedulerState = (): SwapSchedulerState => ({
  poolCursor: 0,
  slotCursors: {},
  failedCandidates: {},
})

const pool = (id: string, size: number): HomepageMediaPool => ({
  id,
  photoshootSlug: id,
  photoshootTitle: id,
  media: Array.from({ length: size }, (_, index) => ({
    id: `${id}-${index}`,
    url: `/media/${id}-${index}.jpg`,
  })),
})

const slot = (
  id: string,
  poolId: string,
  initialMediaIndex = 0,
): HomepageMasonrySlot => ({ id, poolId, initialMediaIndex })

describe('scheduleNextSwap', () => {
  it('skips illegal slots and prioritizes a duplicated assignment', () => {
    const pools = [pool('shoot', 3)]
    const slots = [
      slot('singleton', 'shoot', 0),
      slot('duplicate-a', 'shoot', 1),
      slot('duplicate-b', 'shoot', 1),
    ]

    const result = scheduleNextSwap({
      pools,
      slots,
      currentIndexes: {},
      schedulerState: schedulerState(),
    })

    expect(result.swap).toMatchObject({
      slotId: 'duplicate-a',
      currentIndex: 1,
      nextIndex: 2,
    })
  })

  it('skips a fully occupied pool and schedules the next legal pool', () => {
    const pools = [pool('full', 2), pool('open', 3)]
    const slots = [
      slot('full-0', 'full', 0),
      slot('full-1', 'full', 1),
      slot('open-0', 'open', 0),
    ]

    const result = scheduleNextSwap({
      pools,
      slots,
      currentIndexes: {},
      schedulerState: schedulerState(),
    })

    expect(result.swap?.poolId).toBe('open')
  })

  it.each([2, 3, 5])(
    'reaches every legal photoshoot and item with more pools than %i columns',
    (columnCount) => {
      const pools = Array.from({ length: columnCount + 2 }, (_, index) =>
        pool(`shoot-${index}`, 3),
      )
      const slots = pools.map((item, index) =>
        slot(`slot-${index}`, item.id),
      )
      const columns = arrangeSlotsInColumns(slots, columnCount)
      const leadingSlotIds = new Set(columns.map((column) => column[0].id))
      const visitedPools = new Set<string>()
      const visitedIndexes = new Map(
        pools.map((item) => [item.id, new Set([0])]),
      )
      let currentIndexes: Record<string, number> = {}
      let state = schedulerState()

      for (let cycle = 0; cycle < pools.length * 3; cycle += 1) {
        const result = scheduleNextSwap({
          pools,
          slots,
          currentIndexes,
          schedulerState: state,
        })
        expect(result.swap).not.toBeNull()

        const swap = result.swap!
        visitedPools.add(swap.poolId)
        visitedIndexes.get(swap.poolId)?.add(swap.nextIndex)
        currentIndexes = commitActiveSwap(currentIndexes, {
          slotId: swap.slotId,
          nextIndex: swap.nextIndex,
          frameColor: FALLBACK_TRANSITION_COLOR,
        })
        state = result.schedulerState
      }

      expect(visitedPools).toEqual(new Set(pools.map((item) => item.id)))
      expect(
        Array.from(visitedPools).some((poolId) => {
          const poolSlot = slots.find((item) => item.poolId === poolId)
          return poolSlot && !leadingSlotIds.has(poolSlot.id)
        }),
      ).toBe(true)
      for (const indexes of visitedIndexes.values()) {
        expect(indexes).toEqual(new Set([0, 1, 2]))
      }
    },
  )

  it('advances scheduler state before readiness so a failed preload cannot stall one pool', () => {
    const pools = [pool('first', 3), pool('second', 3)]
    const slots = [slot('first-slot', 'first'), slot('second-slot', 'second')]
    const first = scheduleNextSwap({
      pools,
      slots,
      currentIndexes: {},
      schedulerState: schedulerState(),
    })
    const afterFailure = scheduleNextSwap({
      pools,
      slots,
      currentIndexes: {},
      schedulerState: first.schedulerState,
    })

    expect(first.swap?.poolId).toBe('first')
    expect(afterFailure.swap?.poolId).toBe('second')
  })

  it('reaches a good candidate after a broken candidate fails', () => {
    const pools = [pool('shoot', 3)]
    const slots = [slot('shoot-slot', 'shoot')]
    const broken = scheduleNextSwap({
      pools,
      slots,
      currentIndexes: {},
      schedulerState: schedulerState(),
    })
    expect(broken.swap).toMatchObject({ currentIndex: 0, nextIndex: 1 })

    const afterFailure = scheduleNextSwap({
      pools,
      slots,
      currentIndexes: {},
      schedulerState: recordFailedCandidate(broken.schedulerState, broken.swap!),
    })

    expect(afterFailure.swap).toMatchObject({ currentIndex: 0, nextIndex: 2 })
  })
})

describe('swap lifecycle', () => {
  it('keeps the initial cadence and resets only after a real topology change', () => {
    expect(shouldResetSchedulerTopology(null, 'initial')).toBe(false)
    expect(shouldResetSchedulerTopology('initial', 'initial')).toBe(false)
    expect(shouldResetSchedulerTopology('initial', 'changed')).toBe(true)
  })

  it('commits an active non-leading slot across a breakpoint topology change', () => {
    const slots = Array.from({ length: 6 }, (_, index) =>
      slot(`slot-${index}`, `pool-${index}`),
    )
    const activeSwap = {
      slotId: 'slot-4',
      nextIndex: 2,
      frameColor: '#123456',
    }

    expect(arrangeSlotsInColumns(slots, 5)[4][0].id).toBe('slot-4')
    expect(arrangeSlotsInColumns(slots, 2)[0][2].id).toBe('slot-4')
    expect(commitActiveSwap({}, activeSwap)).toEqual({ 'slot-4': 2 })
  })

  it('uses the outgoing media color when preparing a swap', () => {
    const mediaPool = pool('color', 3)
    mediaPool.media[1].transitionColor = '#A1B2C3'

    expect(createActiveSwap({
      slotId: 'color-slot',
      poolId: 'color',
      currentIndex: 1,
      nextIndex: 2,
    }, mediaPool)).toEqual({
      slotId: 'color-slot',
      nextIndex: 2,
      frameColor: '#a1b2c3',
    })
  })

  it('rejects failed or stale readiness and leaves cleanup without an active swap unchanged', () => {
    const prepared = {
      slotId: 'slot',
      nextIndex: 1,
      frameColor: '#123456',
    }

    expect(acceptReadySwap(prepared, false, 2, 2)).toBeNull()
    expect(acceptReadySwap(prepared, true, 2, 3)).toBeNull()
    expect(acceptReadySwap(prepared, true, 2, 2)).toBe(prepared)

    const current = { slot: 0 }
    expect(commitActiveSwap(current, null)).toBe(current)
  })
})

describe('transition colors', () => {
  it('normalizes valid colors to lowercase six-digit hex', () => {
    expect(normalizeTransitionColor(' #A1B2C3 ')).toBe('#a1b2c3')
    expect(normalizeTransitionColor('#AbC')).toBe('#aabbcc')
  })

  it('uses the media color and falls back for missing or invalid values', () => {
    expect(transitionColorOf({ transitionColor: '#ABCDEF' })).toBe('#abcdef')
    expect(transitionColorOf({ transitionColor: 'red' })).toBe(
      FALLBACK_TRANSITION_COLOR,
    )
    expect(transitionColorOf(undefined)).toBe(FALLBACK_TRANSITION_COLOR)
  })

  it('normalizes persisted snapshot colors without inventing fallback metadata', () => {
    expect(normalizeStoredTransitionColor(' #A1B2C3 ')).toBe('#a1b2c3')
    expect(normalizeStoredTransitionColor('#abc')).toBeNull()
    expect(normalizeStoredTransitionColor('red')).toBeNull()
    expect(normalizeStoredTransitionColor(null)).toBeNull()
  })
})
