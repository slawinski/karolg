'use client'

import Image from 'next/image'
import { useLayoutEffect, useRef } from 'react'
import { mediaPresentationUrl, type MediaLike } from '@/lib/media'
import { mediaRevision } from '@/lib/media-revision'

export function PhotoshootMediaViewer({ media, index, title, opener, onClose }: {
  media: MediaLike[]; index: number; title: string; opener: HTMLButtonElement | null; onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const restore = useRef<(() => void) | null>(null)
  const dismiss = () => {
    dialog.current?.close()
    restore.current?.()
    opener?.isConnected && opener.focus({ preventScroll: true })
    onClose()
  }
  useLayoutEffect(() => {
    const node = dialog.current!
    const x = window.scrollX, y = window.scrollY
    const body = document.body
    const properties = ['position', 'top', 'left', 'width', 'overflow', 'padding-right']
    const saved = properties.map((name) => [name, body.style.getPropertyValue(name), body.style.getPropertyPriority(name)])
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    const padding = parseFloat(getComputedStyle(body).paddingRight)
    body.style.position = 'fixed'
    body.style.top = `${-y}px`
    body.style.left = `${-x}px`
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    if (scrollbar > 0) body.style.paddingRight = `${padding + scrollbar}px`
    let restored = false
    restore.current = () => {
      if (restored) return
      restored = true
      saved.forEach(([name, value, priority]) => body.style.setProperty(name, value, priority))
      window.scrollTo({ left: x, top: y, behavior: 'instant' })
    }
    try {
      node.showModal()
      close.current?.focus({ preventScroll: true })
    } catch {
      restore.current()
      onClose()
    }
    return () => { node.close(); restore.current?.() }
    // The modal session retains the original opener and scroll position across slides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const item = media[index]
  return <dialog ref={dialog} className="photoshoot-viewer" aria-label={`${title} media viewer`}
    onCancel={(event) => { event.preventDefault(); dismiss() }}
    onClose={onClose}>
    <div className="photoshoot-viewer-toolbar">
      <button ref={close} type="button" className="photoshoot-viewer-close" onClick={dismiss}>Close</button>
    </div>
    <div className="photoshoot-viewer-stage">
      <Image key={index} src={mediaPresentationUrl(item)!} alt={item.alt || `${title} image ${index + 1}`}
        fill sizes="100vw" unoptimized={mediaRevision(item.processingRevision) === null} className="photoshoot-viewer-photo" />
    </div>
  </dialog>
}
