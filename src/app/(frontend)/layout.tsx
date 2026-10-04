import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './styles.css'

export const metadata: Metadata = {
  title: {
    default: 'Carla Gorecka — Model / Pilates / Creative',
    template: '%s — Carla Gorecka',
  },
  description: 'Portfolio of Carla Gorecka — model, classical Pilates teacher and creative.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f4f2ea',
}

export default function FrontendLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
