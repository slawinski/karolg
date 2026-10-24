import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Arrow } from '@/components/Arrow'
import { PortfolioHeader } from '@/components/PortfolioHeader'
import { Visual } from '@/components/Visual'
import { PhotoshootGallery } from '@/components/PhotoshootGallery'
import { PublicMediaReadiness } from '@/components/PublicMediaReadiness'
import { PortfolioFooter } from '@/components/PortfolioFooter'
import { photoshootPresentationImage, selectPhotoshootCandidates } from '@/lib/photoshoot-candidates'
import { awaitPublicRequest } from '@/lib/public-rendering'
import {
  getPhotoshootBySlug,
  getPhotoshootMedia,
  getSiteSettings,
  getPhotoshoots,
} from '@/lib/portfolio'

type Props = { params: Promise<{ slug: string }> }

// An empty build-time CMS must not make future photoshoot slugs static fallbacks.
export const dynamic = 'force-dynamic'
export const dynamicParams = true

export async function generateStaticParams() {
  const photoshoots = await getPhotoshoots()
  return photoshoots.map((photoshoot) => ({ slug: photoshoot.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await awaitPublicRequest()
  const { slug } = await params
  const photoshoot = await getPhotoshootBySlug(slug)
  return photoshoot
    ? { title: photoshoot.title, description: photoshoot.excerpt || undefined }
    : {}
}

export default async function WorkPage({ params }: Props) {
  await awaitPublicRequest()
  const { slug } = await params
  const [photoshoot, site] = await Promise.all([
    getPhotoshootBySlug(slug),
    getSiteSettings(),
  ])
  if (!photoshoot?.id) notFound()

  const images = await getPhotoshootMedia(photoshoot.id)
  const candidates = selectPhotoshootCandidates(images)
  const instagram = site.instagram || 'https://www.instagram.com/carlagorecka/'

  return (
    <PublicMediaReadiness routeKey={`/work/${slug}`}><main className="photoshoot-page" id="top">
      <PortfolioHeader instagram={instagram} />

      <section className="photoshoot-head">
        <h1>{photoshoot.title}</h1>
      </section>

      <PhotoshootGallery key={slug} media={images} title={photoshoot.title}>
        {images.map((image, index) => (
          <figure
            className={`photoshoot-gallery-item photoshoot-gallery-item-${(index % 7) + 1} image-frame`}
            key={image.id ?? image.filename ?? index}
          >
            <Visual
              media={image}
              alt={image.alt || `${photoshoot.title} image ${index + 1}`}
              eager={candidates.has(photoshootPresentationImage(image) || '')}
              sizes="(max-width: 700px) calc(50vw - 4px), (max-width: 1100px) calc((100vw - clamp(18px, 2.8vw, 46px) * 2 - clamp(12px, 1.5vw, 24px)) / 2), calc((100vw - clamp(18px, 2.8vw, 46px) * 2 - clamp(12px, 1.5vw, 24px) * 2) / 3)"
              variant={index + 1}
            />
            <button type="button" className="photoshoot-gallery-trigger" data-media-index={index}
              aria-label={`Open ${image.alt || `${photoshoot.title} media ${index + 1}`}`} aria-haspopup="dialog" />
          </figure>
        ))}
      </PhotoshootGallery>

      <section className="photoshoot-info">
        <div>
          <h2>{photoshoot.title}</h2>
          {photoshoot.excerpt ? <p>{photoshoot.excerpt}</p> : null}
        </div>
        <div>
          <p className="eyebrow">Work / Profile</p>
          <Link href="/#about">Profile <Arrow /></Link>
        </div>
      </section>

      <PortfolioFooter name={site.name} statement={site.heroHeadline} instagram={instagram} email={site.email}
        locations={(site.locations || []).map((location) => location.label?.trim()).filter(Boolean).join(' / ')} />
    </main></PublicMediaReadiness>
  )
}
