import { describe, expect, it } from 'vitest'
import type { MediaLike, PhotoshootLike } from './portfolio'
import {
  acceptReadySwap,
  arrangeSlotsInColumns,
  commitActiveSwap,
  FALLBACK_TRANSITION_COLOR,
  composeHomepage,
  createActiveSwap,
  HOMEPAGE_LAYOUT_RATIOS,
  HOMEPAGE_RATIO_WINDOW,
  homepageFrameRatio,
  isWithinHomepageRatioWindow,
  type HomepageMasonrySlot,
  type HomepageMediaPool,
  normalizeTransitionColor,
  normalizeStoredTransitionColor,
  recordFailedCandidate,
  scheduleNextSwap,
  selectNextMediaIndex,
  shouldResetSchedulerTopology,
  topRowSlotsForWave,
  type SwapSchedulerState,
  transitionColorOf,
} from './homepage'

const shoot = (id: number, title = `Shoot ${id}`): PhotoshootLike => ({
  id,
  title,
  slug: `shoot-${id}`,
})

it('compacts normalized pools without losing members, dimensions or revision identities', () => {
  const composition = composeHomepage([shoot(1)], [image(1, shoot(1), {
    processingRevision: 2, caption: 'unused', processingError: 'unused', filesize: 999, width: 1200, height: 1600,
  })], () => 0)
  const compact = compactHomepage(composition)
  expect(compact.slots).toEqual(composition.slots)
  expect(compact.pools[0].media).toHaveLength(1)
  expect(compact.pools[0].media[0]).toMatchObject({ url: '/media/1.jpg?v=2', width: 1200, height: 1600 })
  expect(compact.pools[0].media[0]).not.toHaveProperty('processingError')
  expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(composition).length)
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

  it.each([
    { draw: 0, count: 4 },
    { draw: 0.75, count: 5 },
  ])('prefers measurable portraits for all $count openings when enough exist', ({ draw, count }) => {
    const photoshoot = shoot(1)
    const media = [
      image(1, photoshoot, { width: 1200, height: 800 }),
      image(2, photoshoot, { width: 800, height: 800 }),
      image(3, photoshoot, { height: 1200 }),
      ...Array.from({ length: 6 }, (_, index) =>
        image(index + 4, photoshoot, { width: 800, height: 1200 })),
    ]
    let draws = 0
    const { pools, slots } = composeHomepage([photoshoot], media, () => draws++ === 0 ? draw : 0)

    expect(pools[0].media).toEqual(media)
    expect(slots).toHaveLength(count)
    expect(slots.map((slot) => slot.initialMediaIndex))
      .toEqual(Array.from({ length: count }, (_, index) => index + 3))
  })

  it('uses every available portrait before distinct remainder openings in each own pool', () => {
    const photoshoots = [shoot(1), shoot(2)]
    const media = photoshoots.flatMap((photoshoot, poolIndex) => [
      image(poolIndex * 10 + 1, photoshoot, { width: 1015, height: 1000 }),
      image(poolIndex * 10 + 2, photoshoot),
      image(poolIndex * 10 + 3, photoshoot, { width: 985, height: 1000 }),
      image(poolIndex * 10 + 4, photoshoot, { width: 985, height: 1000 }),
      image(poolIndex * 10 + 5, photoshoot, { width: 1000, height: 1000 }),
    ])
    const { pools, slots } = composeHomepage(photoshoots, media, () => 0)

    expect(slots).toHaveLength(8)
    for (const pool of pools) {
      const openings = slots.filter((slot) => slot.poolId === pool.id)
      expect(openings.map((slot) => slot.initialMediaIndex)).toEqual([2, 3, 0, 1])
      expect(new Set(openings.map((slot) => slot.initialMediaIndex)).size).toBe(4)
      for (const opening of openings) {
        expect(pool.media[opening.initialMediaIndex].photoshoot).toMatchObject({ slug: pool.photoshootSlug })
        // Isolate each opening so sibling occupancy cannot hide the rotation gate.
        const result = scheduleNextSwap({
          pools: [pool], slots: [opening], currentIndexes: {}, schedulerState: schedulerState(),
        })
        if ([2, 3].includes(opening.initialMediaIndex)) {
          expect(result.swap?.nextIndex).toBe(opening.initialMediaIndex === 2 ? 3 : 2)
        } else {
          expect(result.swap).toBeNull()
        }
      }
    }
  })

  it.each([
    { name: 'landscape', dimensions: { width: 1200, height: 800 } },
    { name: 'square', dimensions: { width: 800, height: 800 } },
    { name: 'unmeasurable', dimensions: {} },
    { name: 'portrait', dimensions: { width: 800, height: 1200 } },
  ])('preserves the old openings and random draws for an all-$name pool', ({ name, dimensions }) => {
    const photoshoot = shoot(1)
    const media = Array.from({ length: 7 }, (_, index) => image(index + 1, photoshoot, dimensions))
    const random = sequenceRandom(0.75, 0.9, 0.8, 0.7, 0.6, 0.5)
    let draws = 0
    const composition = composeHomepage([photoshoot], media, () => { draws += 1; return random() })

    expect(composition.slots.map((slot) => slot.initialMediaIndex)).toEqual([6, 5, 1, 2, 3])
    expect(draws).toBe(11)
    if (name !== 'portrait') {
      expect(scheduleNextSwap({
        ...composition, currentIndexes: {}, schedulerState: schedulerState(),
      }).swap).toBeNull()
    }
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

  it('falls through refused candidates while retaining exclusions and sibling diversity', () => {
    expect(selectNextMediaIndex({
      poolSize: 6,
      currentIndex: 0,
      assignedIndexes: [0, 2],
      excludedIndexes: new Set([3]),
      accept: (index) => index !== 1,
    })).toBe(4)
  })

  it('returns no candidate when the predicate refuses every legal index', () => {
    expect(selectNextMediaIndex({
      poolSize: 3,
      currentIndex: 0,
      assignedIndexes: [0],
      accept: () => false,
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
    width: 800,
    height: 1200,
  })),
})

const slot = (
  id: string,
  poolId: string,
  initialMediaIndex = 0,
): HomepageMasonrySlot => ({ id, poolId, initialMediaIndex })

describe('homepageFrameRatio', () => {
  it('pins the frame to the opening media rather than another pool item', () => {
    const mediaPool = pool('shoot', 2)
    mediaPool.media[0] = { width: 985, height: 1000 }
    mediaPool.media[1] = { width: 800, height: 1200 }
    const openingSlot = slot('opening', 'shoot', 1)

    expect(homepageFrameRatio(openingSlot, [openingSlot], mediaPool)).toBe(2 / 3)
  })

  it('falls back to each CSS layout-class ratio and wraps after seven slots', () => {
    const mediaPool = pool('shoot', 1)
    mediaPool.media[0] = { id: 'unmeasurable', url: '/media/unmeasurable.jpg' }
    const slots = Array.from({ length: 8 }, (_, index) => slot(`slot-${index}`, 'shoot'))

    expect(HOMEPAGE_LAYOUT_RATIOS).toEqual([3 / 4, 4 / 5, 1, 2 / 3, 5 / 4, 3 / 5, 4 / 3])
    expect(slots.map((item) => homepageFrameRatio(item, slots, mediaPool)))
      .toEqual([3 / 4, 4 / 5, 1, 2 / 3, 5 / 4, 3 / 5, 4 / 3, 3 / 4])
  })
})

describe('isWithinHomepageRatioWindow', () => {
  it('includes both 15% edges and excludes ratios just beyond them', () => {
    expect(HOMEPAGE_RATIO_WINDOW).toBe(0.15)
    expect(isWithinHomepageRatioWindow(17 / 32, 5 / 8)).toBe(true)
    expect(isWithinHomepageRatioWindow(23 / 32, 5 / 8)).toBe(true)
    expect(isWithinHomepageRatioWindow(17 / 32 - 0.000001, 5 / 8)).toBe(false)
    expect(isWithinHomepageRatioWindow(23 / 32 + 0.000001, 5 / 8)).toBe(false)
  })

  it('rejects a near-square portrait against a 2:3 frame but accepts a matching portrait', () => {
    expect(isWithinHomepageRatioWindow(985 / 1000, 2 / 3)).toBe(false)
    expect(isWithinHomepageRatioWindow(2 / 3, 2 / 3)).toBe(true)
  })
})

describe('scheduleNextSwap', () => {
  it('rotates only compatible portraits in round-robin order through a mixed pool', () => {
    const mediaPool = pool('mixed', 5)
    mediaPool.media[1] = { width: 985, height: 1000 }
    mediaPool.media[2] = { width: 1200, height: 800 }
    mediaPool.media[3] = { url: '/media/unknown.jpg' }
    const slots = [slot('mixed-slot', 'mixed')]
    let currentIndexes: Record<string, number> = {}
    let state = schedulerState()
    const visited: number[] = []

    for (let wave = 0; wave < 5; wave += 1) {
      const result = scheduleNextSwap({ pools: [mediaPool], slots, currentIndexes, schedulerState: state })
      expect(result.swap).not.toBeNull()
      const swap = result.swap!
      visited.push(swap.nextIndex)
      currentIndexes = { ...currentIndexes, [swap.slotId]: swap.nextIndex }
      state = result.schedulerState
    }

    expect(visited).toEqual([4, 0, 4, 0, 4])
  })

  it.each([
    { name: 'landscape', media: { width: 1200, height: 800 } },
    { name: 'square', media: { width: 1000, height: 1000 } },
    { name: 'unmeasurable', media: { url: '/media/unknown.jpg' } },
    { name: 'near-square portrait outside the window', media: { width: 985, height: 1000 } },
  ])('holds the current media and scheduler state when only unused media are $name', ({ media }) => {
    const mediaPool = pool('shoot', 2)
    mediaPool.media[1] = media
    const state = schedulerState()
    const currentIndexes = { opening: 0 }
    const result = scheduleNextSwap({
      pools: [mediaPool], slots: [slot('opening', 'shoot')], currentIndexes, schedulerState: state,
    })

    expect(result.swap).toBeNull()
    expect(result.schedulerState).toBe(state)
    expect(currentIndexes).toEqual({ opening: 0 })
  })

  it.each([
    { name: 'landscape', media: { width: 1015, height: 1000 } },
    { name: 'unmeasurable', media: { url: '/media/unknown.jpg' } },
  ])('refuses a $name opening even when a portrait fits its frame window', ({ media }) => {
    const mediaPool = pool('shoot', 2)
    mediaPool.media[0] = media
    mediaPool.media[1] = { width: 985, height: 1000 }
    const slots = [slot('opening', 'shoot')]
    if (media.width === undefined) mediaPool.media[1] = { width: 720, height: 1000 }
    const result = scheduleNextSwap({ pools: [mediaPool], slots, currentIndexes: {}, schedulerState: schedulerState() })

    expect(result.swap).toBeNull()
  })

  it.each([0.84, 1.16])('rejects ratio factor %s at sixteen percent and accepts fourteen percent', (factor) => {
    const mediaPool = pool('shoot', 3)
    mediaPool.media[1] = { width: 800 * factor, height: 1200 }
    mediaPool.media[2] = { width: 800 * (factor < 1 ? 0.86 : 1.14), height: 1200 }

    expect(scheduleNextSwap({
      pools: [mediaPool], slots: [slot('opening', 'shoot')], currentIndexes: {}, schedulerState: schedulerState(),
    }).swap?.nextIndex).toBe(2)
  })

  it('keeps the window pinned to the opening across successive accepted swaps', () => {
    const mediaPool = pool('shoot', 4)
    mediaPool.media[1] = { width: 850, height: 1200 }
    mediaPool.media[2] = { width: 912, height: 1200 }
    mediaPool.media[3] = { width: 1000, height: 1200 }
    const slots = [slot('opening', 'shoot')]
    let currentIndexes: Record<string, number> = {}
    let state = schedulerState()
    const visited: number[] = []
    for (let wave = 0; wave < 4; wave += 1) {
      const result = scheduleNextSwap({ pools: [mediaPool], slots, currentIndexes, schedulerState: state })
      expect(result.swap).not.toBeNull()
      const swap = result.swap!
      visited.push(swap.nextIndex)
      currentIndexes = { [swap.slotId]: swap.nextIndex }
      state = result.schedulerState
    }

    expect(visited).toEqual([1, 2, 0, 1])
  })

  it('retries exhausted failures without admitting an incompatible candidate', () => {
    const mediaPool = pool('shoot', 3)
    mediaPool.media[1] = { width: 985, height: 1000 }
    const slots = [slot('opening', 'shoot')]
    const state = { ...schedulerState(), failedCandidates: { 'shoot:opening': [2] } }
    const result = scheduleNextSwap({ pools: [mediaPool], slots, currentIndexes: {}, schedulerState: state })

    expect(result.swap).toMatchObject({ currentIndex: 0, nextIndex: 2 })
    expect(result.schedulerState.failedCandidates).toEqual({})
    expect(state.failedCandidates).toEqual({ 'shoot:opening': [2] })
  })

  it('accepts portrait videos using their video or poster dimensions', () => {
    const mediaPool = pool('shoot', 3)
    mediaPool.media[1] = { kind: 'video', videoWidth: 800, videoHeight: 1200 }
    mediaPool.media[2] = { kind: 'video', posterWidth: 800, posterHeight: 1200 }
    const slots = [slot('opening', 'shoot')]
    for (const currentIndex of [0, 1]) {
      expect(scheduleNextSwap({
        pools: [mediaPool], slots, currentIndexes: { opening: currentIndex }, schedulerState: schedulerState(),
      }).swap?.nextIndex).toBe(currentIndex + 1)
    }
  })

  it('only schedules slots included in the eligible set', () => {
    const pools = [pool('shoot', 4)]
    const slots = [
      slot('top', 'shoot', 0),
      slot('lower-a', 'shoot', 1),
      slot('lower-b', 'shoot', 1),
    ]

    const result = scheduleNextSwap({
      pools,
      slots,
      currentIndexes: {},
      schedulerState: schedulerState(),
      eligibleSlotIds: new Set(['top']),
    })

    expect(result.swap?.slotId).toBe('top')
  })

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

describe('topRowSlotsForWave', () => {
  const slots = Array.from({ length: 10 }, (_, index) =>
    slot(`slot-${index}`, `pool-${index}`),
  )

  it.each([
    { columnCount: 2, expected: ['slot-0', 'slot-1'] },
    { columnCount: 3, expected: ['slot-0', 'slot-1', 'slot-2'] },
    { columnCount: 5, expected: ['slot-0', 'slot-1', 'slot-2', 'slot-3', 'slot-4'] },
  ])('returns only the responsive top row for $columnCount columns', ({
    columnCount,
    expected,
  }) => {
    expect(topRowSlotsForWave(slots, columnCount, 'left-to-right').map(({ id }) => id))
      .toEqual(expected)
  })

  it('orders a wave from right to left', () => {
    expect(topRowSlotsForWave(slots, 5, 'right-to-left').map(({ id }) => id))
      .toEqual(['slot-4', 'slot-3', 'slot-2', 'slot-1', 'slot-0'])
  })

  it.each([
    { columnCount: 2, expected: ['slot-0', 'slot-1'] },
    { columnCount: 3, expected: ['slot-1', 'slot-0', 'slot-2'] },
    { columnCount: 4, expected: ['slot-1', 'slot-2', 'slot-0', 'slot-3'] },
    { columnCount: 5, expected: ['slot-2', 'slot-1', 'slot-3', 'slot-0', 'slot-4'] },
  ])('orders $columnCount columns from the middle outward', ({
    columnCount,
    expected,
  }) => {
    expect(topRowSlotsForWave(slots, columnCount, 'middle-out').map(({ id }) => id))
      .toEqual(expected)
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
import { compactHomepage } from './homepage'
