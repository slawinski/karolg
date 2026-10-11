'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MediaLike } from '@/lib/portfolio'

type SwappingVisualProps = {
  images: MediaLike[]
  startIndex: number
  seed: number
  alt: string
  sizes: string
  priority?: boolean
}

const sourceOf = (image: MediaLike | undefined) => image?.url || null

export function SwappingVisual({
  images,
  startIndex,
  seed,
  alt,
  sizes,
  priority = false,
}: SwappingVisualProps) {
  const usableImages = useMemo(
    () => images.filter((image) => Boolean(sourceOf(image))),
    [images],
  )
  const firstIndex = usableImages.length ? startIndex % usableImages.length : 0
  const [currentIndex, setCurrentIndex] = useState(firstIndex)
  const [nextIndex, setNextIndex] = useState(
    usableImages.length > 1 ? (firstIndex + 1) % usableImages.length : firstIndex,
  )
  const [swapping, setSwapping] = useState(false)
  const cycleRef = useRef(0)

  useEffect(() => {
    setCurrentIndex(firstIndex)
    setNextIndex(
      usableImages.length > 1 ? (firstIndex + 1) % usableImages.length : firstIndex,
    )
    setSwapping(false)
    cycleRef.current = 0
  }, [firstIndex, usableImages.length])

  useEffect(() => {
    if (usableImages.length < 2) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches) return

    let swapTimer = 0
    let commitTimer = 0
    let cancelled = false

    const schedule = () => {
      const cycle = cycleRef.current
      // Different tiles keep their own cadence, which makes the wall feel organic
      // while avoiding a synchronized slideshow.
      const delay = 4200 + ((seed * 977 + cycle * 619) % 4200)

      swapTimer = window.setTimeout(() => {
        if (cancelled || document.hidden) {
          cycleRef.current += 1
          schedule()
          return
        }

        setSwapping(true)

        commitTimer = window.setTimeout(() => {
          if (cancelled) return

          setCurrentIndex((current) => {
            const committed = (current + 1) % usableImages.length
            setNextIndex((committed + 1) % usableImages.length)
            return committed
          })
          setSwapping(false)
          cycleRef.current += 1
          schedule()
        }, 820)
      }, delay)
    }

    schedule()

    return () => {
      cancelled = true
      window.clearTimeout(swapTimer)
      window.clearTimeout(commitTimer)
    }
  }, [seed, usableImages.length])

  if (!usableImages.length) {
    return <div className="visual-placeholder" role="img" aria-label={alt} />
  }

  const current = usableImages[currentIndex]
  const next = usableImages[nextIndex]
  const currentSrc = sourceOf(current)
  const nextSrc = sourceOf(next)

  if (!currentSrc) {
    return <div className="visual-placeholder" role="img" aria-label={alt} />
  }

  return (
    <div className={`swap-visual${swapping ? ' is-swapping' : ''}`}>
      {nextSrc && usableImages.length > 1 ? (
        <Image
          src={nextSrc}
          alt=""
          fill
          sizes={sizes}
          className="swap-visual__image swap-visual__image--incoming"
          aria-hidden="true"
        />
      ) : null}

      <Image
        src={currentSrc}
        alt={current.alt || alt}
        fill
        priority={priority}
        sizes={sizes}
        className="swap-visual__image swap-visual__image--current"
      />
    </div>
  )
}
