import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from 'vitest-browser-react'
import { act } from 'react'
import { HomepageMasonry, HomepageVideo } from './HomepageMasonry'
import { PublicMediaReadiness } from './PublicMediaReadiness'
import type { HomepageMediaPool, HomepageMasonrySlot } from '@/lib/homepage'
import '@/app/(frontend)/styles.css'

type ObserverRecord = {
  callback: IntersectionObserverCallback
  elements: Set<Element>
  rootMargin: string
}

let observers: ObserverRecord[] = []
let reducedMotion = false
let pageVisible: DocumentVisibilityState = 'visible'
let motionListeners = new Set<(event: MediaQueryListEvent) => void>()
let preloadSources: string[] = []
let createdVideos: HTMLVideoElement[] = []
const incomingNodes = () => Array.from(document.querySelectorAll<HTMLMediaElement | HTMLImageElement>('.gallery-stage__incoming'))
const advance = async (ms: number) => {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}
const readyIncoming = async () => {
  await act(async () => {
    incomingNodes().forEach((node) => node.dispatchEvent(new Event(node.tagName === 'VIDEO' ? 'canplay' : 'load')))
  })
}
const finishAnimations = async () => {
  await act(async () => {
    document.querySelectorAll('.cursor-masonry__column-motion').forEach((column) => {
      column.dispatchEvent(new AnimationEvent('animationend', {
        bubbles: true, animationName: 'gallery-column-move',
      }))
    })
  })
}
const expectIdleCards = () => {
  expect(incomingNodes()).toHaveLength(0)
  expect(document.querySelector('.is-swapping')).toBeNull()
  document.querySelectorAll('.masonry-card').forEach((card) => {
    expect(card.querySelectorAll('video, img:not(.media-poster)')).toHaveLength(1)
  })
}
const ignoreNativeFixtureEvent = (event: Event) => {
  if (event.isTrusted && event.target instanceof Element &&
    event.target.getAttribute('src')?.includes('/__controlled__/')) event.stopImmediatePropagation()
}

const observerFor = (element: Element, nearViewport: boolean) =>
  observers.find((candidate) => candidate.elements.has(element) &&
    (candidate.rootMargin !== '0px') === nearViewport)

const emitIntersection = async (element: Element, ratio: number) => {
  if (!observerFor(element, false)) {
    await vi.waitFor(() => {
      expect(observerFor(element, false)).toBeDefined()
    })
  }
  const observer = observerFor(element, false)!

  await act(async () => {
    observer.callback([{
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
      url: '/__controlled__/still.jpg',
      width: 1080,
      height: 1800,
    },
    {
      id: 2,
      kind: 'video',
      processingStatus: 'ready',
      playbackFilename: 'generated/2/r1/playback.mp4',
      playbackUrl: '/__controlled__/clip.mp4',
      posterFilename: 'generated/2/r1/poster.jpg',
      posterUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="9" height="16"%3E%3Cpath fill="%23999" d="M0 0h9v16H0z"/%3E%3C/svg%3E',
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
      url: `/__controlled__/still-${index}.jpg`,
      width: 9,
      height: 16,
    },
    {
      id: `video-${index}`,
      kind: 'video',
      processingStatus: 'ready',
      playbackFilename: `generated/${index}/playback.mp4`,
      playbackUrl: `/__controlled__/clip-${index}.mp4`,
      posterFilename: `generated/${index}/poster.jpg`,
      posterUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="9" height="16"%3E%3Cpath fill="%23999" d="M0 0h9v16H0z"/%3E%3C/svg%3E',
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

const imagePool: HomepageMediaPool = {
  ...pools[0],
  media: Array.from({ length: 6 }, (_, index) => ({
    id: `still-${index}`,
    kind: 'image',
    url: `/__controlled__/image-${index}.jpg`,
    width: 2,
    height: 3,
  })),
}

const renderEligible = async (
  mediaPools = wavePools,
  mediaSlots = waveSlots,
) => {
  const rendered = await render(<div className="masonry-stage">
    <h1 className="masonry-name">Carla</h1>
    <HomepageMasonry pools={mediaPools} slots={mediaSlots} />
  </div>)
  await emitIntersection(document.querySelector('.masonry-name')!, 1)
  return rendered
}

beforeEach(() => {
  observers = []
  preloadSources = []
  createdVideos = []
  document.addEventListener('error', ignoreNativeFixtureEvent, true)
  document.addEventListener('load', ignoreNativeFixtureEvent, true)
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
    rootMargin: string
    private record: ObserverRecord
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.rootMargin = options?.rootMargin ?? '0px'
      this.record = { callback, elements: new Set(), rootMargin: this.rootMargin }
      observers.push(this.record)
    }
    observe = (element: Element) => this.record.elements.add(element)
    unobserve = (element: Element) => this.record.elements.delete(element)
    disconnect = () => this.record.elements.clear()
    takeRecords = () => []
    root = null
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
      createdVideos.push(video)
      Object.defineProperty(video, 'load', {
        configurable: true,
        value: () => {
          if (!video.isConnected && video.hasAttribute('src')) {
            preloadSources.push(video.getAttribute('src') || '')
          }
        },
      })
    }
    return element
  })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 })
})

afterEach(async () => {
  document.removeEventListener('error', ignoreNativeFixtureEvent, true)
  document.removeEventListener('load', ignoreNativeFixtureEvent, true)
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  await cleanup()
})

describe('Homepage browser lifecycle', () => {
  it('preserves slot geometry when a swap changes the media aspect ratio', async () => {
    vi.useFakeTimers()
    await renderEligible(pools, slots)
    const before = document.querySelector('figure')!.getBoundingClientRect().toJSON()
    await advance(6000)
    const incoming = document.querySelector<HTMLVideoElement>('video.gallery-stage__incoming')!
    expect(incoming).not.toBeNull()
    expect(getComputedStyle(incoming).objectFit).toBe('cover')
    expect(incoming.getBoundingClientRect().toJSON()).toEqual(before)
    await readyIncoming()
    expect(document.querySelector('video.gallery-stage__incoming')).toBe(incoming)
    expect(incoming.closest('.gallery-stage')?.classList.contains('is-swapping')).toBe(true)
    await finishAnimations()
    expect(document.querySelector('figure')!.getBoundingClientRect().toJSON()).toEqual(before)
    expect(document.querySelector('video.gallery-stage__outgoing')).not.toBeNull()
    expectIdleCards()
  })
  it('holds current acquisition and incoming preparation behind initial image readiness', async () => {
    vi.useFakeTimers()
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false)
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue()
    await render(<PublicMediaReadiness routeKey="home"><div className="masonry-stage">
      <h1 className="masonry-name">Carla</h1>
      <HomepageMasonry pools={pools} slots={slots} />
      <HomepageVideo active alt="Clip" className="clip" media={pools[0].media[1]} />
    </div></PublicMediaReadiness>)
    const video = document.querySelector('video')!
    await emitIntersection(video, 1)
    await emitIntersection(document.querySelector('.masonry-name')!, 1)
    await advance(8000)
    expect(video.hasAttribute('src')).toBe(false)
    expect(incomingNodes()).toHaveLength(0)
    await act(async () => document.querySelector('img[data-public-critical]')!.dispatchEvent(new Event('load')))
    await advance(100)
    expect(video.hasAttribute('src')).toBe(true)
    await emitIntersection(document.querySelector('.masonry-name')!, 1)
    await advance(5999)
    expect(incomingNodes()).toHaveLength(0)
    await advance(1)
    expect(incomingNodes()).toHaveLength(1)
  })
  it('carries replacement identities to images while bypassing legacy optimization', async () => {
    const pool = { ...imagePool, media: [
      { ...imagePool.media[0], processingRevision: 2 },
      imagePool.media[1],
    ] }
    await renderEligible([pool], [
      { ...slots[0], id: 'versioned', initialMediaIndex: 0 },
      { ...slots[0], id: 'legacy', initialMediaIndex: 1 },
    ])
    const image = document.querySelector<HTMLImageElement>('[data-slot="versioned"] img')!
    expect(image.getAttribute('src')).toBe('/__controlled__/image-0.jpg?v=2')
    expect(image.hasAttribute('data-unoptimized')).toBe(false)
    expect(document.querySelector('[data-slot="legacy"] img')?.getAttribute('data-unoptimized')).toBe('true')
  })
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

  it('loads only two stable opening slots eagerly with high priority and keeps later cards lazy', async () => {
    await renderEligible([imagePool], Array.from({ length: 10 }, (_, index) => ({
      id: `loading-slot-${index}`, poolId: imagePool.id, initialMediaIndex: index % 6,
    })))

    const images = Array.from(document.querySelectorAll<HTMLImageElement>('.masonry-card img'))
    expect(images).toHaveLength(10)
    expect(images.filter((image) => image.loading === 'eager')).toHaveLength(2)
    expect(images.filter((image) => image.fetchPriority === 'high')).toHaveLength(2)
    images.forEach((image) => {
      const slot = image.closest('.masonry-card')!.getAttribute('data-slot')
      const opening = slot === 'loading-slot-0' || slot === 'loading-slot-1'
      expect(image.loading).toBe(opening ? 'eager' : 'lazy')
      expect(image.sizes).toContain('(max-width: 700px) calc(50vw - 4px)')
      expect(image.sizes).toContain('150vw')
      expect(image.sizes).toContain('125vw')
    })
    const staticImages = images.filter((image) => image.classList.contains('gallery-static-image'))
    expect(staticImages).toHaveLength(5)
    expect(staticImages.map((image) => getComputedStyle(image).objectFit))
      .toEqual(Array(5).fill('contain'))
  })

  it('uses intrinsic frame dimensions and covers the rotating frame', async () => {
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
        url: `/__controlled__/aspect-${index}.gif`,
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

    expect(frames).toHaveLength(3)
    frames.forEach((frame, index) => {
      const box = frame.getBoundingClientRect()
      expect(box.width / box.height).toBeCloseTo(dimensions[index].width / dimensions[index].height, 2)
    })
    expect(images.map((image) => getComputedStyle(image).objectFit))
      .toEqual(['cover', 'cover', 'cover'])
  })

  it('crop-fills a mismatched portrait still without leaving a gap on either axis', async () => {
    vi.useFakeTimers()
    // A 3:5 incoming image is 10% narrower than the opening 2:3 frame.
    const pool: HomepageMediaPool = {
      ...imagePool,
      media: [imagePool.media[0], { ...imagePool.media[1], width: 3, height: 5 }],
    }
    await renderEligible([pool], slots)
    const frame = document.querySelector('.image-frame')!.getBoundingClientRect().toJSON()
    expect(frame.width).toBeGreaterThan(0)
    expect(frame.height).toBeGreaterThan(0)
    await advance(6_000)
    const incoming = document.querySelector<HTMLImageElement>('img.gallery-stage__incoming')!
    expect(incoming).not.toBeNull()
    expect(incoming.getBoundingClientRect().toJSON()).toEqual(frame)
    expect(getComputedStyle(incoming).objectFit).toBe('cover')
    await readyIncoming()
    expect(document.querySelector('img.gallery-stage__incoming')).toBe(incoming)
    expect(incoming.closest('.gallery-stage')?.classList.contains('is-swapping')).toBe(true)
    await finishAnimations()
    const outgoing = document.querySelector<HTMLImageElement>('img.gallery-stage__outgoing')!
    expect(outgoing.getAttribute('src')).toBe('/__controlled__/image-1.jpg')
    expect(outgoing.getBoundingClientRect().toJSON()).toEqual(frame)
    expect(getComputedStyle(outgoing).objectFit).toBe('cover')
    expectIdleCards()
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
    expect(getComputedStyle(video).opacity).toBe('1')
    const pauseBeforeOffscreen = pause.mock.calls.length
    await emitIntersection(video, 0.09)
    await vi.waitFor(() => {
      expect(pause.mock.calls.length).toBeGreaterThan(pauseBeforeOffscreen)
    })
    expect(getComputedStyle(video).opacity).toBe('0')

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

  it('keeps a current video preview control-free with a full-card project link and only a screen-reader label', async () => {
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
    const card = video.closest('.masonry-card')!
    const link = card.querySelector('.masonry-card__link')!
    const linkStyle = getComputedStyle(link)
    const label = link.querySelector('span')!
    const labelStyle = getComputedStyle(label)

    expect(video.controls).toBe(false)
    expect(getComputedStyle(video).pointerEvents).toBe('none')
    expect(document.querySelector('.gallery-stage__incoming')).toBeNull()
    expect([linkStyle.top, linkStyle.right, linkStyle.bottom, linkStyle.left])
      .toEqual(['0px', '0px', '0px', '0px'])
    expect(label.textContent?.trim()).toBe('View Shoot')
    expect(label.className).toContain('sr-only')
    expect(labelStyle.position).toBe('absolute')
    expect([labelStyle.width, labelStyle.height]).toEqual(['1px', '1px'])
  })

  it('reports mounted preparation video readiness without starting playback or detached loading', async () => {
    const onReady = vi.fn()
    await render(<HomepageVideo
      active={false}
      alt="Incoming clip"
      className="clip"
      media={pools[0].media[1]}
      preparing
      onReady={onReady}
    />)
    const video = document.querySelector('video')!

    expect(video.isConnected).toBe(true)
    expect(video.preload).toBe('auto')
    expect(onReady).not.toHaveBeenCalled()
    await emitIntersection(video, 1)
    await act(async () => { video.dispatchEvent(new Event('canplay')) })

    expect(onReady).toHaveBeenCalledTimes(1)
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
    expect(preloadSources).toEqual([])
  })

  it('reports mounted video failure and defers metadata preload until the video nears the viewport', async () => {
    const onReady = vi.fn()
    const onError = vi.fn()
    await render(<HomepageVideo
      active={false}
      alt="Clip"
      className="clip"
      media={pools[0].media[1]}
      onReady={onReady}
      onError={onError}
    />)
    const video = document.querySelector('video')!
    expect(video.preload).toBe('none')
    expect(video.hasAttribute('src')).toBe(false)

    await emitIntersection(video, 1)
    expect(video.preload).toBe('metadata')
    expect(video.getAttribute('src')).toBe('/__controlled__/clip.mp4?v=1')

    await act(async () => {
      const callsBeforeError = onError.mock.calls.length
      video.dispatchEvent(new Event('error'))
      expect(onError).toHaveBeenCalledTimes(callsBeforeError + 1)
    })

    expect(onReady).not.toHaveBeenCalled()
    expect(preloadSources).toEqual([])
  })

  it('reports cached mounted video readiness without waiting for canplay', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get')
      .mockReturnValue(HTMLMediaElement.HAVE_FUTURE_DATA)
    const onReady = vi.fn(() => {
      expect(document.querySelector('video')?.isConnected).toBe(true)
    })
    await render(<HomepageVideo
      active={false}
      alt="Cached incoming clip"
      className="clip"
      media={pools[0].media[1]}
      preparing
      onReady={onReady}
    />)

    expect(onReady).toHaveBeenCalledTimes(1)
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
    expect(preloadSources).toEqual([])
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
    await advance(0)

    await advance(5_999)
    expect(incomingNodes()).toHaveLength(0)
    await advance(1)
    expect(incomingNodes()).toHaveLength(1)
    expect(document.querySelector('.is-swapping')).toBeNull()
    await readyIncoming()

    await vi.waitFor(() => {
      const outgoing = document.querySelector('img.gallery-stage__outgoing')
      const incoming = document.querySelector('video.gallery-stage__incoming')
      expect(outgoing).not.toBeNull()
      expect(incoming).not.toBeNull()
      expect(getComputedStyle(outgoing!).objectFit).toBe('cover')
      expect(getComputedStyle(incoming!).objectFit).toBe('cover')
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
    await advance(6_000)
    await readyIncoming()

    expect(column(1).querySelector('.is-swapping')).not.toBeNull()
    expect(column(2).querySelector('.is-swapping')).toBeNull()
    expect(column(1).querySelectorAll('.masonry-card')[1]
      .querySelector('.gallery-stage__incoming')).toBeNull()

    await advance(239)
    expect(column(2).querySelector('.is-swapping')).toBeNull()
    await advance(1)
    expect(column(2).querySelector('.is-swapping')).not.toBeNull()

    await emitIntersection(title, 0)
    for (const card of firstCards) await emitIntersection(card, 0)
    await advance(10_000)
    expect(document.querySelector('.is-swapping')).toBeNull()

    await emitIntersection(title, 1)
    await advance(6_999)
    expect(incomingNodes()).toHaveLength(0)
    await advance(1)
    await readyIncoming()
    expect(column(5).querySelector('.is-swapping')).not.toBeNull()
    expect(preloadSources).toEqual([])
  })

  it('cancels a wave for reduced motion and waits before restarting', async () => {
    vi.useFakeTimers()
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
    await advance(6_000)
    await readyIncoming()
    await vi.waitFor(() => {
      expect(document.querySelector('.is-swapping')).not.toBeNull()
    })

    reducedMotion = true
    await act(async () => {
      motionListeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent))
    })
    expect(document.querySelector('.is-swapping')).toBeNull()
    await advance(10_000)
    expect(document.querySelector('.is-swapping')).toBeNull()

    reducedMotion = false
    await act(async () => {
      motionListeners.forEach((listener) => listener({ matches: false } as MediaQueryListEvent))
    })
    await advance(6_999)
    expect(incomingNodes()).toHaveLength(0)
    await advance(1)
    await readyIncoming()
    expect(document.querySelector('[data-slot="slot-4"] .is-swapping')).not.toBeNull()
  })

  it('cancels mounted preparation at a breakpoint and restarts scheduling', async () => {
    vi.useFakeTimers()
    await render(
      <div className="masonry-stage">
        <h1 className="masonry-name">Carla</h1>
        <HomepageMasonry pools={pools} slots={slots} />
      </div>,
    )
    await emitIntersection(document.querySelector('.masonry-name')!, 1)
    await emitIntersection(document.querySelector('[data-first-row="true"]')!, 1)
    await advance(0)
    await advance(6_000)
    expect(incomingNodes()).toHaveLength(1)
    const stalePreload = incomingNodes()[0]

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 })
    window.dispatchEvent(new Event('resize'))
    await advance(0)
    expect(stalePreload.isConnected).toBe(false)
    stalePreload.dispatchEvent(new Event('canplay'))
    await advance(0)
    expect(document.querySelector('video.gallery-stage__incoming')).toBeNull()

    await emitIntersection(document.querySelector('.masonry-name')!, 1)
    await advance(6_000)
    await vi.waitFor(() => {
      expect(document.querySelector('video.gallery-stage__incoming')).not.toBeNull()
    })
  })

  it('does not render a former desktop top-row swap in a mobile lower row', async () => {
    vi.useFakeTimers()
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
    await advance(6_000)
    await readyIncoming()
    await advance(960)
    await vi.waitFor(() => {
      expect(document.querySelector('[data-slot="slot-4"] .gallery-stage.is-swapping'))
        .not.toBeNull()
    })

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 })
    window.dispatchEvent(new Event('resize'))
    await advance(0)

    const formerTopRow = document.querySelector('[data-slot="slot-4"]')!
    expect(formerTopRow.getAttribute('data-first-row')).toBeNull()
    expect(formerTopRow.querySelector('.gallery-stage.is-swapping')).toBeNull()
  })

  it('gates on every connected candidate and retains node identity through stagger and commit', async () => {
    vi.useFakeTimers()
    await render(<div className="masonry-stage">
      <h1 className="masonry-name">Carla</h1>
      <HomepageMasonry pools={wavePools} slots={waveSlots} />
    </div>)
    expect(incomingNodes()).toHaveLength(0)
    await emitIntersection(document.querySelector('.masonry-name')!, 1)
    await advance(6_000)
    const nodes = incomingNodes()
    expect(nodes).toHaveLength(5)
    expect(nodes.every((node) => node.isConnected)).toBe(true)
    expect(createdVideos.filter((video) => video.hasAttribute('src'))).toEqual(nodes)
    nodes.forEach((node) => expect(getComputedStyle(node).opacity).toBe('0'))
    await act(async () => {
      nodes.slice(1).reverse().forEach((node) => node.dispatchEvent(new Event('canplay')))
      // A later error cannot override a ready terminal result.
      nodes[1].dispatchEvent(new Event('error'))
    })
    expect(document.querySelector('.is-swapping')).toBeNull()
    expect(incomingNodes()).toEqual(nodes)
    nodes.forEach((node) => expect(getComputedStyle(node).opacity).toBe('0'))
    await act(async () => { nodes[0].dispatchEvent(new Event('canplay')) })
    expect(nodes[0].closest('.gallery-stage')?.classList.contains('is-swapping')).toBe(true)
    expect(nodes[1].closest('.gallery-stage')?.classList.contains('is-swapping')).toBe(false)
    expect(getComputedStyle(nodes[1]).opacity).toBe('0')
    await advance(239)
    expect(incomingNodes()).toEqual(nodes)
    expect(nodes[1].closest('.gallery-stage')?.classList.contains('is-swapping')).toBe(false)
    expect(getComputedStyle(nodes[1]).opacity).toBe('0')
    await advance(1)
    // Seek the real CSS animation: JS fake timers do not advance the browser animation clock.
    const reveal = nodes[1].getAnimations().find((animation) =>
      animation instanceof CSSAnimation && animation.animationName === 'gallery-in')!
    expect(reveal).toBeDefined()
    reveal.pause()
    reveal.currentTime = 750
    expect(getComputedStyle(nodes[1]).opacity).toBe('0')
    reveal.currentTime = 1125
    expect(Number(getComputedStyle(nodes[1]).opacity)).toBeGreaterThan(0)
    reveal.currentTime = 1500
    expect(getComputedStyle(nodes[1]).opacity).toBe('1')
    await advance(720)
    expect(incomingNodes()).toEqual(nodes)
    expect(document.querySelectorAll('.gallery-stage.is-swapping')).toHaveLength(5)
    await act(async () => {
      document.querySelectorAll('.cursor-masonry__column-motion').forEach((column) => {
        column.dispatchEvent(new AnimationEvent('animationend', {
          bubbles: true, animationName: 'gallery-column-move',
        }))
      })
    })
    expect(incomingNodes()).toHaveLength(0)
    expect(document.querySelectorAll('video.gallery-stage__outgoing')).toHaveLength(5)
    expect(preloadSources).toEqual([])
  })

  it('settles an all-failed deadline once and recovers after the later cycle delay', async () => {
    vi.useFakeTimers()
    await render(<div className="masonry-stage">
      <h1 className="masonry-name">Carla</h1>
      <HomepageMasonry pools={wavePools} slots={waveSlots} />
    </div>)
    await emitIntersection(document.querySelector('.masonry-name')!, 1)
    await advance(6_000)
    const stale = incomingNodes()
    await act(async () => { stale[0].dispatchEvent(new Event('error')) })
    await advance(4_999)
    expect(document.querySelector('.is-swapping')).toBeNull()
    await advance(1)
    expect(incomingNodes()).toHaveLength(0)
    await act(async () => { stale.forEach((node) => node.dispatchEvent(new Event('canplay'))) })
    await advance(6_999)
    expect(incomingNodes()).toHaveLength(0)
    await advance(1)
    expect(incomingNodes()).toHaveLength(5)
    await readyIncoming()
    expect(document.querySelector('[data-slot="slot-4"] .is-swapping')).not.toBeNull()
    expect(document.querySelector('[data-slot="slot-0"] .is-swapping')).toBeNull()
  })

  it('invalidates preparation synchronously when visibility hides in the final readiness turn', async () => {
    vi.useFakeTimers()
    await render(<div className="masonry-stage">
      <h1 className="masonry-name">Carla</h1>
      <HomepageMasonry pools={pools} slots={slots} />
    </div>)
    await emitIntersection(document.querySelector('.masonry-name')!, 1)
    await advance(6_000)
    const stale = incomingNodes()[0]
    await act(async () => {
      pageVisible = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))
      stale.dispatchEvent(new Event('canplay'))
    })
    expect(incomingNodes()).toHaveLength(0)
    expect(document.querySelector('video.gallery-stage__outgoing')).toBeNull()
    await act(async () => {
      pageVisible = 'visible'
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await advance(5_999)
    expect(incomingNodes()).toHaveLength(0)
    await advance(1)
    await readyIncoming()
    expect(document.querySelector('.gallery-stage.is-swapping')).not.toBeNull()
  })

  it('uses only connected eager incoming images and ignores an error after their load', async () => {
    vi.useFakeTimers()
    const detachedImage = vi.spyOn(window, 'Image')
    await renderEligible([imagePool], slots)
    expectIdleCards()
    const current = document.querySelector<HTMLImageElement>('.gallery-stage__outgoing')!
    expect(current.getAttribute('loading')).toBe('eager')
    expect(current.fetchPriority).toBe('high')
    await advance(6_000)
    const incoming = incomingNodes()[0] as HTMLImageElement
    expect(incoming.isConnected).toBe(true)
    expect(incoming.getAttribute('src')).toBe('/__controlled__/image-1.jpg')
    expect(incoming.loading).toBe('eager')
    expect(document.querySelector('.is-swapping')).toBeNull()
    await act(async () => {
      incoming.dispatchEvent(new Event('load'))
      incoming.dispatchEvent(new Event('error'))
    })
    expect(incomingNodes()[0]).toBe(incoming)
    expect(document.querySelector('.gallery-stage.is-swapping')).not.toBeNull()
    await finishAnimations()
    expectIdleCards()
    expect(document.querySelector('img.gallery-stage__outgoing')?.getAttribute('src'))
      .toBe('/__controlled__/image-1.jpg')
    expect(document.querySelector('img.gallery-stage__outgoing')?.getAttribute('loading'))
      .toBe('eager')
    expect(detachedImage).not.toHaveBeenCalled()
    expect(preloadSources).toEqual([])
  })

  it('finalizes partial image failures in planned same-pool order, not event order', async () => {
    vi.useFakeTimers()
    const sharedSlots = [0, 1, 2].map((index) => ({
      id: `shared-${index}`, poolId: imagePool.id, initialMediaIndex: index,
    }))
    await renderEligible([imagePool, wavePools[3]], [...sharedSlots, waveSlots[3]])
    await advance(6_000)
    const nodes = incomingNodes()
    expect(nodes).toHaveLength(4)
    expect(nodes.slice(0, 3).map((node) => node.getAttribute('src'))).toEqual([
      '/__controlled__/image-3.jpg', '/__controlled__/image-4.jpg', '/__controlled__/image-5.jpg',
    ])
    await act(async () => {
      nodes[2].dispatchEvent(new Event('load'))
      nodes[3].dispatchEvent(new Event('canplay'))
      nodes[1].dispatchEvent(new Event('error'))
      nodes[1].dispatchEvent(new Event('load'))
    })
    expect(document.querySelector('.is-swapping')).toBeNull()
    await act(async () => { nodes[0].dispatchEvent(new Event('load')) })
    expect(incomingNodes()).toEqual([nodes[0], nodes[3]])
    expect(document.querySelector('[data-slot="shared-0"] .is-swapping')).not.toBeNull()
    expect(document.querySelector('[data-slot="slot-3"] .is-swapping')).toBeNull()
    await advance(239)
    expect(document.querySelector('[data-slot="slot-3"] .is-swapping')).toBeNull()
    await advance(1)
    expect(incomingNodes()).toEqual([nodes[0], nodes[3]])
    expect(document.querySelector('[data-slot="slot-3"] .is-swapping')).not.toBeNull()
    await finishAnimations()
    expectIdleCards()
    expect(sharedSlots.map((slot) => document.querySelector(
      `[data-slot="${slot.id}"] .gallery-stage__outgoing`,
    )?.getAttribute('src'))).toEqual([
      '/__controlled__/image-3.jpg', '/__controlled__/image-1.jpg', '/__controlled__/image-2.jpg',
    ])
  })

  it('cleans up an all-error image wave and recovers without retrying its failed index', async () => {
    vi.useFakeTimers()
    await renderEligible(wavePools.map((pool) => ({ ...imagePool, id: pool.id })))
    await advance(6_000)
    const stale = incomingNodes()
    expect(stale).toHaveLength(5)
    await act(async () => {
      stale.slice().reverse().forEach((node) => {
        node.dispatchEvent(new Event('error'))
        node.dispatchEvent(new Event('load'))
      })
    })
    expectIdleCards()
    expect(document.querySelector('.gallery-stage__outgoing')?.getAttribute('src'))
      .toBe('/__controlled__/image-0.jpg')
    await advance(6_999)
    expectIdleCards()
    await advance(1)
    expect(incomingNodes()).toHaveLength(5)
    expect(incomingNodes().every((node) => node.getAttribute('src') === '/__controlled__/image-2.jpg'))
      .toBe(true)
    await readyIncoming()
    await advance(960)
    await finishAnimations()
    expectIdleCards()
    expect(document.querySelector('.gallery-stage__outgoing')?.getAttribute('src'))
      .toBe('/__controlled__/image-2.jpg')
  })

  it.each(['ready', 'timeout'] as const)('lets %s win once at the preparation deadline', async (winner) => {
    vi.useFakeTimers()
    await renderEligible([imagePool], slots)
    // Register before the wave deadline so this load wins an exact-time tie.
    if (winner === 'ready') {
      window.setTimeout(() => incomingNodes()[0].dispatchEvent(new Event('load')), 11_000)
    }
    await advance(6_000)
    const node = incomingNodes()[0]
    await advance(4_999)
    expect(document.querySelector('.is-swapping')).toBeNull()
    await advance(1)
    await act(async () => {
      node.dispatchEvent(new Event('load'))
      node.dispatchEvent(new Event('error'))
    })
    if (winner === 'ready') {
      expect(incomingNodes()).toEqual([node])
      expect(document.querySelector('.gallery-stage.is-swapping')).not.toBeNull()
      await finishAnimations()
    }
    expectIdleCards()
    expect(document.querySelector('.gallery-stage__outgoing')?.getAttribute('src'))
      .toBe(`/__controlled__/image-${winner === 'ready' ? 1 : 0}.jpg`)
    await advance(6_999)
    expectIdleCards()
    await advance(1)
    expect(incomingNodes()).toHaveLength(1)
    expect(incomingNodes()[0].getAttribute('src')).toBe('/__controlled__/image-2.jpg')
  })

  it.each(['motion', 'resize', 'intersection'] as const)(
    'invalidates preparation before final readiness in the native %s callback turn',
    async (reason) => {
      vi.useFakeTimers()
      await renderEligible()
      await advance(6_000)
      const nodes = incomingNodes()
      await act(async () => {
        nodes.slice(1).forEach((node) => node.dispatchEvent(new Event('canplay')))
      })
      await act(async () => {
        if (reason === 'motion') {
          reducedMotion = true
          motionListeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent))
        } else if (reason === 'resize') {
          Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 })
          window.dispatchEvent(new Event('resize'))
        } else {
          const title = document.querySelector('.masonry-name')!
          observers.find((observer) => observer.elements.has(title))!.callback([{
            target: title, isIntersecting: false, intersectionRatio: 0,
          } as IntersectionObserverEntry], {} as IntersectionObserver)
        }
        nodes[0].dispatchEvent(new Event('canplay'))
      })
      expectIdleCards()
      expect(document.querySelector('video.gallery-stage__outgoing')).toBeNull()
      expect(nodes.every((node) => !node.isConnected)).toBe(true)
      if (reason === 'motion') {
        await act(async () => {
          reducedMotion = false
          motionListeners.forEach((listener) => listener({ matches: false } as MediaQueryListEvent))
        })
      } else {
        await emitIntersection(document.querySelector('.masonry-name')!, 1)
      }
      await advance(5_999)
      expectIdleCards()
      await advance(1)
      expect(incomingNodes()).toHaveLength(reason === 'resize' ? 2 : 5)
      await readyIncoming()
      expect(document.querySelector('[data-slot="slot-0"] .is-swapping')).not.toBeNull()
      if (reason === 'resize') {
        expect(document.querySelector('[data-slot="slot-4"]')?.getAttribute('data-first-row')).toBeNull()
        expect(document.querySelector('[data-slot="slot-4"] .gallery-stage__incoming')).toBeNull()
      }
    },
  )

  it('discards preparation without recording failure or committing and retries after a full initial delay', async () => {
    vi.useFakeTimers()
    await renderEligible([imagePool], slots)
    await advance(6_000)
    const stale = incomingNodes()[0]
    await act(async () => {
      pageVisible = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))
      stale.dispatchEvent(new Event('error'))
    })
    expectIdleCards()
    await advance(10_000)
    await act(async () => {
      pageVisible = 'visible'
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await advance(5_999)
    expectIdleCards()
    await advance(1)
    const fresh = incomingNodes()[0]
    expect(fresh).not.toBe(stale)
    expect(fresh.getAttribute('src')).toBe('/__controlled__/image-1.jpg')
    await act(async () => { stale.dispatchEvent(new Event('load')) })
    expect(document.querySelector('.is-swapping')).toBeNull()
    await readyIncoming()
    await finishAnimations()
    expectIdleCards()
  })

  it.each(['stagger', 'animation', 'resize-stagger'] as const)(
    'commits only launched swaps once on %s cancellation and discards queued nodes',
    async (phase) => {
      vi.useFakeTimers()
      await renderEligible()
      await advance(6_000)
      const stale = incomingNodes()
      await readyIncoming()
      await advance(phase === 'animation' ? 960 : 240)
      const launched = phase === 'animation' ? 5 : 2
      expect(document.querySelectorAll('.gallery-stage.is-swapping')).toHaveLength(launched)
      await act(async () => {
        if (phase === 'resize-stagger') {
          Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 })
          window.dispatchEvent(new Event('resize'))
        } else {
          pageVisible = 'hidden'
          document.dispatchEvent(new Event('visibilitychange'))
        }
        stale.forEach((node) => node.dispatchEvent(new Event('canplay')))
      })
      expectIdleCards()
      const currentSources = () => waveSlots.map((slot) => {
        const node = document.querySelector(
          `[data-slot="${slot.id}"] video, [data-slot="${slot.id}"] img:not(.media-poster)`,
        )
        return node instanceof HTMLVideoElement ? 'video' : node?.getAttribute('src')
      })
      const expected = waveSlots.map((_, index) => index < launched
        ? 'video' : `/__controlled__/still-${index}.jpg`)
      expect(currentSources()).toEqual(expected)
      await finishAnimations()
      if (phase === 'resize-stagger') {
        // A resize is itself the restart point; it does not hide the page.
        await emitIntersection(document.querySelector('.masonry-name')!, 1)
      } else {
        await advance(5_000)
        expectIdleCards()
        expect(currentSources()).toEqual(expected)
        await act(async () => {
          pageVisible = 'visible'
          document.dispatchEvent(new Event('visibilitychange'))
        })
      }
      await advance(6_999)
      expectIdleCards()
      await advance(1)
      expect(incomingNodes()).toHaveLength(phase === 'resize-stagger' ? 2 : 5)
      await readyIncoming()
      // Exactly one cycle advanced: right-to-left, not middle-out or the initial direction.
      const first = phase === 'resize-stagger' ? 'slot-1' : 'slot-4'
      expect(document.querySelector(`[data-slot="${first}"] .is-swapping`)).not.toBeNull()
      expect(document.querySelectorAll('.gallery-stage.is-swapping')).toHaveLength(1)
    },
  )

  it.each(['preparation', 'stagger'] as const)(
    'resets replaced prop topology during %s and rejects old media callbacks',
    async (phase) => {
      vi.useFakeTimers()
      const rendered = await renderEligible()
      await advance(6_000)
      const stale = incomingNodes()
      if (phase === 'stagger') {
        await readyIncoming()
        await advance(240)
      }
      const replacementSlots = slots.map((slot) => ({ ...slot, id: 'replacement' }))
      await rendered.rerender(<div className="masonry-stage">
        <h1 className="masonry-name">Carla</h1>
        <HomepageMasonry pools={[imagePool]} slots={replacementSlots} />
      </div>)
      await act(async () => {
        stale.forEach((node) => node.dispatchEvent(new Event('canplay')))
      })
      expectIdleCards()
      expect(document.querySelectorAll('.masonry-card')).toHaveLength(1)
      expect(document.querySelector('.gallery-stage__outgoing')?.getAttribute('src'))
        .toBe('/__controlled__/image-0.jpg')
      await emitIntersection(document.querySelector('.masonry-name')!, 1)
      await advance(6_999)
      expectIdleCards()
      await advance(1)
      expect(incomingNodes()).toHaveLength(1)
      expect(incomingNodes()[0].getAttribute('src')).toBe('/__controlled__/image-1.jpg')
      await readyIncoming()
      await finishAnimations()
      expectIdleCards()
    },
  )

  it.each(['preparation', 'stagger', 'animation'] as const)(
    'settles owned work when equivalent props replace arrays during %s',
    async (phase) => {
      vi.useFakeTimers()
      const mediaPools = phase === 'stagger' ? wavePools : [imagePool]
      const mediaSlots = phase === 'stagger' ? waveSlots : slots
      const rendered = await renderEligible(mediaPools, mediaSlots)
      await advance(6_000)
      const stale = incomingNodes()
      if (phase !== 'preparation') await readyIncoming()
      if (phase === 'stagger') await advance(240)
      await rendered.rerender(<div className="masonry-stage">
        <h1 className="masonry-name">Carla</h1>
        <HomepageMasonry
          pools={mediaPools.map((pool) => ({ ...pool, media: [...pool.media] }))}
          slots={mediaSlots.map((slot) => ({ ...slot }))}
        />
      </div>)
      expectIdleCards()
      if (phase === 'animation') {
        expect(document.querySelector('.gallery-stage__outgoing')?.getAttribute('src'))
          .toBe('/__controlled__/image-1.jpg')
      }
      await act(async () => {
        stale.forEach((node) => node.dispatchEvent(new Event(node.tagName === 'VIDEO' ? 'canplay' : 'load')))
      })
      await finishAnimations()
      expectIdleCards()
      await advance(phase === 'preparation' ? 6_000 : 7_000)
      expect(incomingNodes()).toHaveLength(phase === 'stagger' ? 5 : 1)
      await readyIncoming()
      await advance(960)
      await finishAnimations()
      expectIdleCards()
    },
  )

  it('releases the playback resource when a preparing video is unmounted', async () => {
    const rendered = await render(<HomepageVideo
      active={false}
      alt="Pending clip"
      className="clip"
      media={pools[0].media[1]}
      preparing
    />)
    const video = document.querySelector('video')!
    const load = vi.spyOn(video, 'load')
    await rendered.unmount()
    expect(video.hasAttribute('src')).toBe(false)
    expect(load).toHaveBeenCalled()
    expect(preloadSources).toEqual([])
  })

  it('launches ready participants at the shared deadline and ignores timed-out readiness', async () => {
    vi.useFakeTimers()
    await renderEligible(wavePools.slice(0, 2), waveSlots.slice(0, 2))
    await advance(6_000)
    const [ready, timedOut] = incomingNodes()
    await act(async () => { ready.dispatchEvent(new Event('canplay')) })
    await advance(4_999)
    expect(document.querySelector('.is-swapping')).toBeNull()
    await advance(1)
    expect(incomingNodes()).toEqual([ready])
    expect(document.querySelector('[data-slot="slot-0"] .is-swapping')).not.toBeNull()
    expect(timedOut.isConnected).toBe(false)
    await act(async () => { timedOut.dispatchEvent(new Event('canplay')) })
    expect(document.querySelector('[data-slot="slot-1"] .is-swapping')).toBeNull()
    await finishAnimations()
    expectIdleCards()
    await advance(7_000)
    await readyIncoming()
    await advance(240)
    await finishAnimations()
    expectIdleCards()
  })

  it.each(['preparation', 'stagger'] as const)(
    'cleans up timers and rejects old callbacks after masonry unmount during %s',
    async (phase) => {
      vi.useFakeTimers()
      const rendered = await renderEligible()
      await advance(6_000)
      const stale = incomingNodes()
      if (phase === 'stagger') await readyIncoming()
      await rendered.unmount()
      await act(async () => {
        stale.forEach((node) => node.dispatchEvent(new Event('canplay')))
      })
      await advance(20_000)
      expect(document.querySelector('.masonry-card')).toBeNull()
      expect(incomingNodes()).toHaveLength(0)
      stale.forEach((node) => expect(node.hasAttribute('src')).toBe(false))
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it('preserves all three directional orders, 240ms stagger and seven-second later cadence', async () => {
    vi.useFakeTimers()
    await renderEligible()
    const orders = [[0, 1, 2, 3, 4], [4, 3, 2, 1, 0], [2, 1, 3, 0, 4]]
    for (const [cycle, order] of orders.entries()) {
      await advance(cycle === 0 ? 5_999 : 6_999)
      expectIdleCards()
      await advance(1)
      const nodes = incomingNodes()
      expect(nodes).toHaveLength(5)
      await act(async () => {
        order.slice().reverse().forEach((index) => {
          const node = nodes[index]
          node.dispatchEvent(new Event(node.tagName === 'VIDEO' ? 'canplay' : 'load'))
        })
      })
      expect(getComputedStyle(document.querySelector('.cursor-masonry__column-motion.is-swapping')!)
        .animationDuration).toBe('1.5s')
      for (let index = 0; index < order.length; index += 1) {
        if (index > 0) {
          await advance(239)
          expect(document.querySelectorAll('.gallery-stage.is-swapping')).toHaveLength(index)
          await advance(1)
        }
        expect(document.querySelector(`[data-slot="slot-${order[index]}"] .is-swapping`))
          .not.toBeNull()
        expect(document.querySelectorAll('.gallery-stage.is-swapping')).toHaveLength(index + 1)
        expect(incomingNodes()).toEqual(nodes)
      }
      await finishAnimations()
      expectIdleCards()
    }
    expect(preloadSources).toEqual([])
  })

  it('defers video sources to the near viewport behind a decorative optimized poster layer', async () => {
    const pool: HomepageMediaPool = {
      ...pools[0],
      media: [
        { ...pools[0].media[1], processingRevision: 3 },
        pools[0].media[1],
      ],
    }
    await render(
      <div className="masonry-stage">
        <h1 className="masonry-name">Carla</h1>
        <HomepageMasonry pools={[pool]} slots={[
          { ...slots[0], id: 'versioned-video', initialMediaIndex: 0 },
          { ...slots[0], id: 'legacy-video', initialMediaIndex: 1 },
        ]} />
      </div>,
    )

    const posters = Array.from(document.querySelectorAll<HTMLImageElement>('.media-poster'))
    const videos = Array.from(document.querySelectorAll('video'))
    expect(posters).toHaveLength(2)
    expect(videos).toHaveLength(2)
    expect(posters.every((poster) => poster.getAttribute('alt') === '')).toBe(true)
    expect(posters.every((poster) => poster.getAttribute('aria-hidden') === 'true')).toBe(true)
    expect(posters.map((poster) => poster.hasAttribute('data-unoptimized'))).toEqual([false, true])
    expect(videos.every((video) => !video.hasAttribute('src'))).toBe(true)
    expect(videos.map((video) => video.preload)).toEqual(['none', 'none'])
    expect(posters.map((poster) => getComputedStyle(poster).objectFit)).toEqual(['cover', 'cover'])
    posters.forEach((poster) => {
      expect(poster.getBoundingClientRect().toJSON())
        .toEqual(poster.closest('.image-frame')!.getBoundingClientRect().toJSON())
    })

    await emitIntersection(videos[0], 1)
    expect(videos[0].getAttribute('src')).toBe('/__controlled__/clip.mp4?v=1')
    expect(videos[0].preload).toBe('metadata')
    expect(videos[1].hasAttribute('src')).toBe(false)
    expect(videos[1].preload).toBe('none')
    posters[0].dispatchEvent(new Event('error'))
    expect(getComputedStyle(posters[0]).display).toBe('none')
    expect(document.querySelector('.gallery-stage__color')).not.toBeNull()
    posters[0].dispatchEvent(new Event('load'))
    expect(getComputedStyle(posters[0]).display).toBe('block')
  })

  it('keeps posters outside rotating homepage stages contained, including project video posters', async () => {
    await render(<>
      <img className="media-poster" alt="" />
      <img className="media-poster photoshoot-video-poster" alt="" />
    </>)
    const posters = Array.from(document.querySelectorAll('.media-poster'))
    expect(posters.map((poster) => getComputedStyle(poster).objectFit)).toEqual(['contain', 'contain'])
  })
})
