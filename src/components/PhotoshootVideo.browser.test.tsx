import { act } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render } from 'vitest-browser-react'
import type { MediaLike } from '@/lib/media'
import { PhotoshootVideo } from './PhotoshootVideo'
import '@/app/(frontend)/styles.css'

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

type ObserverRecord = {
  callback: IntersectionObserverCallback
  elements: Set<Element>
}

let observers: ObserverRecord[] = []

const clip: MediaLike = {
  id: 9,
  kind: 'video',
  processingStatus: 'ready',
  playbackFilename: 'studio-tour.mp4',
  playbackUrl: '/__controlled__/studio-tour.mp4',
  posterFilename: 'studio-tour.jpg',
  posterUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
}

const renderClip = () =>
  render(<PhotoshootVideo alt="Studio tour" className="visual-img visual-video" media={clip} />)

const actWithEnvironment = async (callback: () => void | Promise<void>) => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  try {
    await act(callback)
  } finally {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false
  }
}

const emitNearIntersection = async (element: Element) => {
  await vi.waitFor(() => {
    expect(observers.some((observer) => observer.elements.has(element))).toBe(true)
  })
  const observer = observers.find((candidate) => candidate.elements.has(element))!

  await actWithEnvironment(() => {
    observer.callback([{
      target: element,
      isIntersecting: true,
      intersectionRatio: 0,
    } as IntersectionObserverEntry], {} as IntersectionObserver)
  })
}

beforeEach(() => {
  observers = []
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
    rootMargin = '200% 0px'
    thresholds = [0]
  })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  await cleanup()
})

it('keeps manual playback unplayed and unloaded until the video nears the viewport', async () => {
  await renderClip()
  const video = document.querySelector('video')!

  expect(video.controls).toBe(true)
  expect(video.playsInline).toBe(true)
  expect(video.autoplay).toBe(false)
  expect(video.preload).toBe('none')
  expect(video.hasAttribute('src')).toBe(false)
  expect(video.getAttribute('poster')).toBe(clip.posterUrl)
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
})

it('acquires the deferred playback source once the video nears the viewport', async () => {
  await renderClip()
  const video = document.querySelector('video')!
  expect(video.hasAttribute('src')).toBe(false)

  await emitNearIntersection(video)

  expect(video.getAttribute('src')).toBe(clip.playbackUrl)
  expect(video.preload).toBe('metadata')
  expect(video.controls).toBe(true)
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
})

it('acquires the deferred playback source on pointer and keyboard intent', async () => {
  await renderClip()
  const pointerVideo = document.querySelector('video')!
  expect(pointerVideo.hasAttribute('src')).toBe(false)

  await actWithEnvironment(() => {
    pointerVideo.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  })
  expect(pointerVideo.getAttribute('src')).toBe(clip.playbackUrl)

  await cleanup()
  await renderClip()
  const keyboardVideo = document.querySelector('video')!
  expect(keyboardVideo.hasAttribute('src')).toBe(false)

  await actWithEnvironment(() => {
    keyboardVideo.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  })
  expect(keyboardVideo.getAttribute('src')).toBe(clip.playbackUrl)
})
