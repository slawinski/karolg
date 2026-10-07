import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Anton } from 'next/font/google'
import './styles.css'

const chase = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--chase',
  display: 'swap',
})

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
  viewportFit: 'cover',
  themeColor: '#f4f1e6',
}

export default function FrontendLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={chase.variable}>
      <body>{children}</body>
    </html>
  )
}
