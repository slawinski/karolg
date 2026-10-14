import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from 'vitest-browser-react'
import { act } from 'react'
import { HomepageMasonry, HomepageVideo } from './HomepageMasonry'
import type { HomepageMediaPool, HomepageMasonrySlot } from '@/lib/homepage'

type ObserverRecord = {
  callback: IntersectionObserverCallback
  elements: Set<Element>
}

let observers: ObserverRecord[] = []
let reducedMotion = false
let pageVisible: DocumentVisibilityState = 'visible'
let motionListeners = new Set<(event: MediaQueryListEvent) => void>()
let pendingPreloads: HTMLVideoElement[] = []
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
    { id: 1, kind: 'image', url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' },
    {
      id: 2,
      kind: 'video',
      processingStatus: 'ready',
      playbackFilename: 'generated/2/r1/playback.mp4',
      playbackUrl: 'data:video/mp4;base64,AAAA',
      posterFilename: 'generated/2/r1/poster.jpg',
      posterUrl: 'data:image/jpeg;base64,/9j/2Q==',
    },
  ],
}]
const slots: HomepageMasonrySlot[] = [{
  id: 'shoot-slot',
  poolId: 'shoot',
  initialMediaIndex: 0,
}]

beforeEach(() => {
  observers = []
  pendingPreloads = []
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

    await emitIntersection(video, 0.1)
    await vi.waitFor(() => expect(play).toHaveBeenCalled())
    await emitIntersection(video, 0.09)
    await vi.waitFor(() => expect(pause).toHaveBeenCalled())

    await emitIntersection(video, 0.5)
    pageVisible = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(pause.mock.calls.length).toBeGreaterThan(1))

    const playCount = play.mock.calls.length
    await rendered.unmount()
    reducedMotion = true
    await render(<HomepageVideo
      active
      alt="Reduced motion clip"
      className="reduced-clip"
      media={pools[0].media[1]}
    />)
    const reducedVideo = document.querySelector('video')!
    await emitIntersection(reducedVideo, 1)
    await vi.waitFor(() => expect(reducedVideo.controls).toBe(true))
    expect(play.mock.calls).toHaveLength(playCount)
    expect(pause.mock.calls.length).toBeGreaterThan(1)
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
      expect(document.querySelector('img.gallery-stage__outgoing')).not.toBeNull()
      expect(document.querySelector('video.gallery-stage__incoming')).not.toBeNull()
    })
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
    stalePreload.oncanplay?.(new Event('canplay'))
    await vi.advanceTimersByTimeAsync(0)
    expect(document.querySelector('video.gallery-stage__incoming')).toBeNull()

    autoResolvePreloads = true
    await vi.advanceTimersByTimeAsync(6_000)
    await vi.waitFor(() => {
      expect(document.querySelector('video.gallery-stage__incoming')).not.toBeNull()
    })
  })
})
