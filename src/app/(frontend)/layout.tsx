import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Anton } from 'next/font/google'
import { getSiteSettings } from '@/lib/portfolio'
import { awaitPublicRequest } from '@/lib/public-rendering'
import './styles.css'

const chase = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--chase',
  display: 'swap',
})

const baseMetadata: Metadata = {
  title: {
    default: 'Carla Gorecka — Model / Pilates / Creative',
    template: '%s — Carla Gorecka',
  },
  description: 'Portfolio of Carla Gorecka — model, classical Pilates teacher and creative.',
  icons: {
    icon: '/favicon.svg',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  await awaitPublicRequest()
  const { socialImage } = await getSiteSettings()
  const metadataBase = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://carlagorecka.com')
  const metadata = { ...baseMetadata, metadataBase }
  if (!socialImage || typeof socialImage !== 'object' || !socialImage.url ||
    socialImage.kind === 'video' || !['image/jpeg', 'image/png'].includes(socialImage.mimeType || '')) {
    return metadata
  }
  const image = {
    url: new URL(socialImage.url, metadataBase).href,
    width: socialImage.width || undefined,
    height: socialImage.height || undefined,
    alt: socialImage.alt || 'Carla Gorecka portfolio',
  }
  return {
    ...metadata,
    openGraph: { images: [image] },
    twitter: { card: 'summary_large_image', images: [image] },
  }
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
