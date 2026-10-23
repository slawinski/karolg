'use client'

import Image from 'next/image'
import { useId, useLayoutEffect, useRef } from 'react'
import { inferMediaKind, mediaPresentationUrl, type MediaLike } from '@/lib/media'
import { mediaRevision } from '@/lib/media-revision'

export function PhotoshootMediaViewer({ media, index, title, opener, onClose, onChange }: {
  media: MediaLike[]; index: number; title: string; opener: HTMLButtonElement | null; onClose: () => void; onChange: (index: number) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const restore = useRef<(() => void) | null>(null)
  const instructions = useId()
  const touch = useRef<{ x: number; y: number; id: number } | null>(null)
  const navigate = (direction: number) => {
    const next = index + direction
    if (next >= 0 && next < media.length) onChange(next)
  }
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
  const video = inferMediaKind(item) === 'video'
  return <dialog ref={dialog} className="photoshoot-viewer" aria-label={`${title} media viewer`}
    aria-describedby={instructions}
    onKeyDown={(event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if ((event.target as Element).closest('video, input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        navigate(event.key === 'ArrowRight' ? 1 : -1)
      }
    }}
    onCancel={(event) => { event.preventDefault(); dismiss() }}
    onClose={onClose}>
    <div className="photoshoot-viewer-toolbar">
      <button ref={close} type="button" className="photoshoot-viewer-close" onClick={dismiss}>Close</button>
    </div>
    <p id={instructions} className="sr-only">Use left and right arrow keys or swipe horizontally to browse. On videos, swipe outside the player. Escape closes the viewer.</p>
    <p className="sr-only" aria-live="polite">Item {index + 1} of {media.length}</p>
    <div className={`photoshoot-viewer-stage${video ? ' photoshoot-viewer-video-stage' : ''}`}
      onTouchStart={(event) => {
        touch.current = null
        if (event.touches.length !== 1 || (event.target as Element).closest('video')) return
        const point = event.touches[0]
        touch.current = { x: point.clientX, y: point.clientY, id: point.identifier }
      }}
      onTouchMove={(event) => { if (event.touches.length !== 1) touch.current = null }}
      onTouchCancel={() => { touch.current = null }}
      onTouchEnd={(event) => {
        const start = touch.current
        touch.current = null
        if (!start || event.touches.length || event.changedTouches.length !== 1) return
        const end = event.changedTouches[0]
        if (end.identifier !== start.id) return
        const dx = end.clientX - start.x, dy = end.clientY - start.y
        if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5) navigate(dx < 0 ? 1 : -1)
      }}>
      {video ? <div className="photoshoot-viewer-video-region" aria-label={item.alt || `${title} video ${index + 1}`} /> :
      <Image key={index} src={mediaPresentationUrl(item)!} alt={item.alt || `${title} image ${index + 1}`}
        fill sizes="100vw" unoptimized={mediaRevision(item.processingRevision) === null} className="photoshoot-viewer-photo" />}
    </div>
  </dialog>
}
