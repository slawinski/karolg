import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Arrow } from '@/components/Arrow'
import { PortfolioHeader } from '@/components/PortfolioHeader'
import { Visual } from '@/components/Visual'
import {
  getPhotoshootBySlug,
  getPhotoshootMedia,
  getPortfolioData,
} from '@/lib/portfolio'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export async function generateStaticParams() {
  const { photoshoots } = await getPortfolioData()
  return photoshoots.map((photoshoot) => ({ slug: photoshoot.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const photoshoot = await getPhotoshootBySlug(slug)
  return photoshoot
    ? { title: photoshoot.title, description: photoshoot.excerpt || undefined }
    : {}
}

export default async function WorkPage({ params }: Props) {
  const { slug } = await params
  const [photoshoot, { site }] = await Promise.all([
    getPhotoshootBySlug(slug),
    getPortfolioData(),
  ])
  if (!photoshoot?.id) notFound()

  const images = await getPhotoshootMedia(photoshoot.id)
  const instagram = site.instagram || 'https://www.instagram.com/carlagorecka/'

  return (
    <main className="photoshoot-page">
      <PortfolioHeader instagram={instagram} />

      <section className="photoshoot-head">
        <h1>{photoshoot.title}</h1>
      </section>

      <section className="photoshoot-gallery" aria-label={`${photoshoot.title} portfolio`}>
        {images.map((image, index) => (
          <figure
            className={`photoshoot-gallery-item photoshoot-gallery-item-${(index % 7) + 1} image-frame`}
            key={image.id ?? image.filename ?? index}
          >
            <Visual
              media={image}
              alt={image.alt || `${photoshoot.title} image ${index + 1}`}
              sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
              variant={index + 1}
            />
          </figure>
        ))}
      </section>

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

      <footer className="project-footer">
        <Link href="/#work">Selected work</Link>
        <span>© {new Date().getFullYear()} {site.name || 'Carla Gorecka'}</span>
        <Link href="/#about">Profile</Link>
      </footer>
    </main>
  )
}
