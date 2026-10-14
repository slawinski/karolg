import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from 'vitest-browser-react'
import { act } from 'react'
import { HomepageMasonry, HomepageVideo } from './HomepageMasonry'
import type { HomepageMediaPool, HomepageMasonrySlot } from '@/lib/homepage'
import '@/app/(frontend)/styles.css'

type ObserverRecord = {
  callback: IntersectionObserverCallback
  elements: Set<Element>
}

let observers: ObserverRecord[] = []
let reducedMotion = false
let pageVisible: DocumentVisibilityState = 'visible'
let motionListeners = new Set<(event: MediaQueryListEvent) => void>()
let pendingPreloads: HTMLVideoElement[] = []
let preloadSources: string[] = []
let autoResolvePreloads = false

const emitIntersection = async (element: Element, ratio: number) => {
  let observer = observers.find((candidate) => candidate.elements.has(element))
  if (!observer) {
    await vi.waitFor(() => {
      expect(observers.some((candidate) => candidate.elements.has(element))).toBe(true)
    })
    observer = observers.find((candidate) => candidate.elements.has(element))
  }

  await act(async () => {
    observer!.callback([{
      target: element,
      isIntersecting: ratio > 0,
      intersectionRatio: ratio,
    } as IntersectionObserverEntry], {} as IntersectionObserver)
  })
}

const pools: HomepageMediaPool[] = [{
  id: 'shoot',
  photoshootSlug: 'shoot',
  photoshootTitle: 'Shoot',
  media: [
    {
      id: 1,
      kind: 'image',
      url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
      width: 1600,
      height: 900,
    },
    {
      id: 2,
      kind: 'video',
      processingStatus: 'ready',
      playbackFilename: 'generated/2/r1/playback.mp4',
      playbackUrl: 'data:video/mp4;base64,AAAA',
      posterFilename: 'generated/2/r1/poster.jpg',
      posterUrl: 'data:image/jpeg;base64,/9j/2Q==',
      videoWidth: 1080,
      videoHeight: 1920,
    },
  ],
}]
const slots: HomepageMasonrySlot[] = [{
  id: 'shoot-slot',
  poolId: 'shoot',
  initialMediaIndex: 0,
}]

const wavePools: HomepageMediaPool[] = Array.from({ length: 6 }, (_, index) => ({
  id: `shoot-${index}`,
  photoshootSlug: `shoot-${index}`,
  photoshootTitle: `Shoot ${index}`,
  media: [
    {
      id: `image-${index}`,
      kind: 'image',
      url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
      width: 4,
      height: 3,
    },
    {
      id: `video-${index}`,
      kind: 'video',
      processingStatus: 'ready',
      playbackFilename: `generated/${index}/playback.mp4`,
      playbackUrl: `data:video/mp4;base64,AAAA${index}`,
      posterFilename: `generated/${index}/poster.jpg`,
      posterUrl: 'data:image/jpeg;base64,/9j/2Q==',
      videoWidth: 9,
      videoHeight: 16,
    },
  ],
}))

const waveSlots: HomepageMasonrySlot[] = wavePools.map((pool, index) => ({
  id: `slot-${index}`,
  poolId: pool.id,
  initialMediaIndex: 0,
}))

beforeEach(() => {
  observers = []
  pendingPreloads = []
  preloadSources = []
  autoResolvePreloads = false
  const createElement = document.createElement.bind(document)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  reducedMotion = false
  pageVisible = 'visible'
  motionListeners = new Set()
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => pageVisible,
  })
  vi.stubGlobal('IntersectionObserver', class {
    private record: ObserverRecord
    constructor(callback: IntersectionObserverCallback) {
      this.record = { callback, elements: new Set() }
      observers.push(this.record)
    }
    observe = (element: Element) => this.record.elements.add(element)
    unobserve = (element: Element) => this.record.elements.delete(element)
    disconnect = () => this.record.elements.clear()
    takeRecords = () => []
    root = null
    rootMargin = '0px'
    thresholds = [0]
  })
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : true,
    media: query,
    onchange: null,
    addEventListener: (_name: string, listener: (event: MediaQueryListEvent) => void) => {
      if (query.includes('prefers-reduced-motion')) motionListeners.add(listener)
    },
    removeEventListener: (_name: string, listener: (event: MediaQueryListEvent) => void) => {
      motionListeners.delete(listener)
    },
    addListener() {},
    removeListener() {},
    dispatchEvent: () => true,
  }))
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
    const element = createElement(tagName, options)
    if (tagName.toLowerCase() === 'video') {
      const video = element as HTMLVideoElement
      Object.defineProperty(video, 'load', {
        configurable: true,
        value: () => {
          if (!video.isConnected && video.hasAttribute('src')) {
            pendingPreloads.push(video)
            preloadSources.push(video.getAttribute('src') || '')
            if (autoResolvePreloads) {
              queueMicrotask(() => video.oncanplay?.(new Event('canplay')))
            }
          }
        },
      })
    }
    return element
  })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 })
})

afterEach(async () => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  await cleanup()
})

describe('Homepage browser lifecycle', () => {
  it('uses the photoshoot title typeface for both homepage name rows', async () => {
    await render(
      <>
        <h1 className="masonry-name">
          <span className="masonry-name__first">Carla</span>
          <span className="masonry-name__last">Gorecka</span>
        </h1>
        <div className="photoshoot-head"><h1>Editorial</h1></div>
      </>,
    )

    const titleFont = getComputedStyle(
      document.querySelector('.photoshoot-head h1')!,
    ).fontFamily
    expect(getComputedStyle(document.querySelector('.masonry-name__first')!).fontFamily)
      .toBe(titleFont)
    expect(getComputedStyle(document.querySelector('.masonry-name__last')!).fontFamily)
      .toBe(titleFont)
  })

  it('uses intrinsic frame dimensions and contains the complete image', async () => {
    const dimensions = [
      { width: 1600, height: 900 },
      { width: 900, height: 1600 },
      { width: 1000, height: 1000 },
    ]
    const aspectPools = dimensions.map((size, index) => ({
      id: `aspect-${index}`,
      photoshootSlug: `aspect-${index}`,
      photoshootTitle: `Aspect ${index}`,
      media: [{
        id: `aspect-media-${index}`,
        kind: 'image' as const,
        url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
        ...size,
      }],
    }))
    const aspectSlots = aspectPools.map((pool, index) => ({
      id: `aspect-slot-${index}`,
      poolId: pool.id,
      initialMediaIndex: 0,
    }))

    await render(
      <div className="masonry-stage">
        <h1 className="masonry-name">Carla</h1>
        <HomepageMasonry pools={aspectPools} slots={aspectSlots} />
      </div>,
    )

    const frames = Array.from(
      document.querySelectorAll<HTMLElement>('.image-frame'),
    )
    const images = Array.from(
      document.querySelectorAll<HTMLImageElement>('.gallery-stage__outgoing'),
    )

    expect(frames.map((frame) => frame.style.aspectRatio)).toEqual([
      '1600 / 900',
      '900 / 1600',
      '1000 / 1000',
    ])
    expect(images.map((image) => getComputedStyle(image).objectFit))
      .toEqual(['contain', 'contain', 'contain'])
  })

  it('plays only while active, at least 10% visible, page-visible, and motion-safe', async () => {
    const rendered = await render(<HomepageVideo
      active
      alt="Motion clip"
      className="clip"
      media={pools[0].media[1]}
    />)
    const video = document.querySelector('video')!
    const play = vi.mocked(HTMLMediaElement.prototype.play)
    const pause = vi.mocked(HTMLMediaElement.prototype.pause)

    expect(video.controls).toBe(false)
    expect(video.loop).toBe(true)
    expect(video.muted).toBe(true)
    expect(video.playsInline).toBe(true)

    await emitIntersection(video, 0.1)
    await vi.waitFor(() => expect(play).toHaveBeenCalled())
    const pauseBeforeOffscreen = pause.mock.calls.length
    await emitIntersection(video, 0.09)
    await vi.waitFor(() => {
      expect(pause.mock.calls.length).toBeGreaterThan(pauseBeforeOffscreen)
    })

    await emitIntersection(video, 0.5)
    await vi.waitFor(() => expect(play.mock.calls.length).toBeGreaterThan(1))
    const pauseBeforeHidden = pause.mock.calls.length
    pageVisible = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => {
      expect(pause.mock.calls.length).toBeGreaterThan(pauseBeforeHidden)
    })

    const playCount = play.mock.calls.length
    await rendered.unmount()
    reducedMotion = true
    pageVisible = 'visible'
    await render(<HomepageVideo
      active
      alt="Reduced motion clip"
      className="reduced-clip"
      media={pools[0].media[1]}
    />)
    const reducedVideo = document.querySelector('video')!
    await emitIntersection(reducedVideo, 1)
    await vi.waitFor(() => expect(reducedVideo.controls).toBe(false))
    expect(play.mock.calls).toHaveLength(playCount)
    expect(pause.mock.calls.length).toBeGreaterThan(1)
  })

  it('keeps a current video preview control-free with a full-card project link', async () => {
    const videoFirstPool: HomepageMediaPool = {
      ...pools[0],
      media: [pools[0].media[1], pools[0].media[0]],
    }
    await render(
      <div className="masonry-stage">
        <h1 className="masonry-name">Carla</h1>
        <HomepageMasonry pools={[videoFirstPool]} slots={slots} />
      </div>,
    )

    const video = document.querySelector<HTMLVideoElement>('.gallery-stage__outgoing')!
    const link = document.querySelector('.masonry-card__link--video')!
    const linkStyle = getComputedStyle(link)

    expect(video.controls).toBe(false)
    expect(getComputedStyle(video).pointerEvents).toBe('none')
    expect([linkStyle.top, linkStyle.right, linkStyle.bottom, linkStyle.left])
      .toEqual(['0px', '0px', '0px', '0px'])
  })

  it('renders a mixed image-to-video swap after the initial six-second cadence', async () => {
    vi.useFakeTimers()
    await render(
      <div className="masonry-stage">
        <h1 className="masonry-name">Carla</h1>
        <HomepageMasonry pools={pools} slots={slots} />
      </div>,
    )
    const title = document.querySelector('.masonry-name')!
    const firstCard = document.querySelector('[data-first-row="true"]')!
    await emitIntersection(title, 1)
    await emitIntersection(firstCard, 1)
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(5_999)
    expect(pendingPreloads).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(pendingPreloads).toHaveLength(1)
    pendingPreloads.shift()!.oncanplay?.(new Event('canplay'))

    await vi.waitFor(() => {
      const outgoing = document.querySelector('img.gallery-stage__outgoing')
      const incoming = document.querySelector('video.gallery-stage__incoming')
      expect(outgoing).not.toBeNull()
      expect(incoming).not.toBeNull()
      expect(getComputedStyle(outgoing!).objectFit).toBe('contain')
      expect(getComputedStyle(incoming!).objectFit).toBe('contain')
      expect(getComputedStyle(incoming!).pointerEvents).toBe('none')
      const link = incoming!.closest('.masonry-card')!
        .querySelector('.masonry-card__link')!
      const linkStyle = getComputedStyle(link)
      expect([linkStyle.top, linkStyle.right, linkStyle.bottom, linkStyle.left])
        .toEqual(['0px', '0px', '0px', '0px'])
    })
  })

  it('runs a staggered top-row wave and restarts from a fresh direction after scrolling away', async () => {
    vi.useFakeTimers()
    autoResolvePreloads = true
    await render(
      <div className="masonry-stage">
        <h1 className="masonry-name">Carla</h1>
        <HomepageMasonry pools={wavePools} slots={waveSlots} />
      </div>,
    )
    const title = document.querySelector('.masonry-name')!
    const firstCards = Array.from(document.querySelectorAll('[data-first-row="true"]'))
    const column = (index: number) =>
      document.querySelector(`.cursor-masonry__column[data-column="${index}"]`)!

    await emitIntersection(title, 1)
    for (const card of firstCards) await emitIntersection(card, 1)
    await vi.advanceTimersByTimeAsync(6_000)

    await vi.waitFor(() => {
      expect(column(1).querySelector('.is-swapping')).not.toBeNull()
    })
    expect(column(2).querySelector('.is-swapping')).toBeNull()
    expect(column(1).querySelectorAll('.masonry-card')[1]
      .querySelector('.gallery-stage__incoming')).toBeNull()

    await vi.advanceTimersByTimeAsync(239)
    expect(column(2).querySelector('.is-swapping')).toBeNull()
    await vi.advanceTimersByTimeAsync(1)
    await vi.waitFor(() => {
      expect(column(2).querySelector('.is-swapping')).not.toBeNull()
    })

    await emitIntersection(title, 0)
    for (const card of firstCards) await emitIntersection(card, 0)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(document.querySelector('.is-swapping')).toBeNull()

    await emitIntersection(title, 1)
    const preloadCount = preloadSources.length
    await vi.advanceTimersByTimeAsync(6_999)
    expect(preloadSources).toHaveLength(preloadCount)
    await vi.advanceTimersByTimeAsync(1)
    expect(preloadSources.length).toBeGreaterThan(preloadCount)
    expect(preloadSources[preloadCount]).toContain('AAAA4')
  })

  it('cancels a wave for reduced motion and waits before restarting', async () => {
    vi.useFakeTimers()
    autoResolvePreloads = true
    await render(
      <div className="masonry-stage">
        <h1 className="masonry-name">Carla</h1>
        <HomepageMasonry pools={wavePools} slots={waveSlots} />
      </div>,
    )
    const title = document.querySelector('.masonry-name')!
    const firstCards = Array.from(document.querySelectorAll('[data-first-row="true"]'))

    await emitIntersection(title, 1)
    for (const card of firstCards) await emitIntersection(card, 1)
    await vi.advanceTimersByTimeAsync(6_000)
    await vi.waitFor(() => {
      expect(document.querySelector('.is-swapping')).not.toBeNull()
    })

    reducedMotion = true
    await act(async () => {
      motionListeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent))
    })
    expect(document.querySelector('.is-swapping')).toBeNull()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(document.querySelector('.is-swapping')).toBeNull()

    reducedMotion = false
    await act(async () => {
      motionListeners.forEach((listener) => listener({ matches: false } as MediaQueryListEvent))
    })
    const preloadCount = preloadSources.length
    await vi.advanceTimersByTimeAsync(6_999)
    expect(preloadSources).toHaveLength(preloadCount)
    await vi.advanceTimersByTimeAsync(1)
    expect(preloadSources.length).toBeGreaterThan(preloadCount)
    expect(preloadSources[preloadCount]).toContain('AAAA4')
  })

  it('cancels an in-flight preload at a breakpoint and restarts scheduling', async () => {
    vi.useFakeTimers()
    await render(
      <div className="masonry-stage">
        <h1 className="masonry-name">Carla</h1>
        <HomepageMasonry pools={pools} slots={slots} />
      </div>,
    )
    await emitIntersection(document.querySelector('.masonry-name')!, 1)
    await emitIntersection(document.querySelector('[data-first-row="true"]')!, 1)
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(6_000)
    expect(pendingPreloads).toHaveLength(1)
    const stalePreload = pendingPreloads.shift()!

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 })
    window.dispatchEvent(new Event('resize'))
    await vi.advanceTimersByTimeAsync(0)
    expect(stalePreload.hasAttribute('src')).toBe(false)
    expect(stalePreload.oncanplay).toBeNull()
    stalePreload.oncanplay?.(new Event('canplay'))
    await vi.advanceTimersByTimeAsync(0)
    expect(document.querySelector('video.gallery-stage__incoming')).toBeNull()

    autoResolvePreloads = true
    await vi.advanceTimersByTimeAsync(6_000)
    await vi.waitFor(() => {
      expect(document.querySelector('video.gallery-stage__incoming')).not.toBeNull()
    })
  })

  it('does not render a former desktop top-row swap in a mobile lower row', async () => {
    vi.useFakeTimers()
    autoResolvePreloads = true
    await render(
      <div className="masonry-stage">
        <h1 className="masonry-name">Carla</h1>
        <HomepageMasonry pools={wavePools} slots={waveSlots} />
      </div>,
    )
    const title = document.querySelector('.masonry-name')!
    const firstCards = Array.from(document.querySelectorAll('[data-first-row="true"]'))

    await emitIntersection(title, 1)
    for (const card of firstCards) await emitIntersection(card, 1)
    await vi.advanceTimersByTimeAsync(6_960)
    await vi.waitFor(() => {
      expect(document.querySelector('[data-slot="slot-4"] .gallery-stage.is-swapping'))
        .not.toBeNull()
    })

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 })
    window.dispatchEvent(new Event('resize'))
    await vi.advanceTimersByTimeAsync(0)

    const formerTopRow = document.querySelector('[data-slot="slot-4"]')!
    expect(formerTopRow.getAttribute('data-first-row')).toBeNull()
    expect(formerTopRow.querySelector('.gallery-stage.is-swapping')).toBeNull()
  })
})
