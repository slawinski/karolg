'use client'

import { useRef, useState, type ReactNode } from 'react'
import type { MediaLike } from '@/lib/media'
import { PhotoshootMediaViewer } from './PhotoshootMediaViewer'

export function PhotoshootGallery({ media, title, children }: { media: MediaLike[]; title: string; children: ReactNode }) {
  const [selected, setSelected] = useState<number | null>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  return <>
    <section className="photoshoot-gallery" aria-label={`${title} portfolio`} onClick={(event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-media-index]')
      if (!button || !event.currentTarget.contains(button)) return
      const index = Number(button.dataset.mediaIndex)
      if (!media[index]) return
      opener.current = button
      setSelected(index)
    }}>{children}</section>
    {selected !== null && <PhotoshootMediaViewer media={media} index={selected} title={title}
      opener={opener.current} onChange={setSelected} onClose={() => setSelected(null)} />}
  </>
}
