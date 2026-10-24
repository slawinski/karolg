'use client'

import { useRef, useState, type MouseEvent, type ReactNode } from 'react'
import type { MediaLike } from '@/lib/media'
import { PhotoshootMediaViewer } from './PhotoshootMediaViewer'

type PhotoshootGalleryProps = {
  media: MediaLike[]
  title: string
  children: ReactNode
}

export function PhotoshootGallery({ media, title, children }: PhotoshootGalleryProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const opener = useRef<HTMLButtonElement | null>(null)

  const openMedia = (event: MouseEvent<HTMLElement>) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-media-index]')
    if (!button || !event.currentTarget.contains(button)) return
    const index = Number(button.dataset.mediaIndex)
    if (!media[index]) return
    opener.current = button
    setSelected(index)
  }

  return <>
    <section className="photoshoot-gallery" aria-label={`${title} portfolio`} onClick={openMedia}>
      {children}
    </section>
    {selected !== null && (
      <PhotoshootMediaViewer
        media={media}
        index={selected}
        title={title}
        opener={opener.current}
        onChange={setSelected}
        onClose={() => setSelected(null)}
      />
    )}
  </>
}
