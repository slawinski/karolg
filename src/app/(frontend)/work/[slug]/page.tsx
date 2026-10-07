import type { Metadata } from 'next'
import Link from 'next/link'
import {
  fallbackProjects,
  notFound } from 'next/navigation'
import { Arrow } from '@/components/Arrow'
import { Visual } from '@/components/Visual'
import {
  fallbackProjects,
  placeholderMedia,
  type MediaLike,
  getProjectBySlug,
} from '@/lib/portfolio'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return fallbackProjects.map((project) => ({ slug: project.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const project = await getProjectBySlug(slug)
  return project ? { title: project.title, description: project.excerpt || undefined } : {}
}

export default async function WorkPage({ params }: Props) {
  const { slug } = await params
  const project = await getProjectBySlug(slug)
  if (!project) notFound()

  const gallery = (project.gallery?.filter((item) => typeof item === 'object') || []) as MediaLike[]
  const images = gallery.length
    ? gallery
    : [
        ...placeholderMedia,
        ...placeholderMedia.slice(0, 3),
      ]

  return (
    <main className="artist-page">
      <header className="header">
        <Link className="brand" href="/">Carla Gorecka</Link>
        <nav className="nav" aria-label="Primary navigation">
          <Link href="/#work">Work</Link>
          <Link href="/#about">About</Link>
          <Link href="/#contact">Contact</Link>
        </nav>
        <Link className="menu-link" href="/#work">Close</Link>
      </header>

      <section className="artist-head">
        <div>
          <h1>{project.title}</h1>
          <p className="artist-count">({String(images.length).padStart(2, '0')}) All</p>
        </div>
        <nav className="artist-filters" aria-label="Portfolio filters">
          <span>All ({String(images.length).padStart(2, '0')})</span>
          <span>{project.category}</span>
          <span>Portrait</span>
          <span>Movement</span>
          <span>Personal</span>
        </nav>
      </section>

      <section className="artist-masonry" aria-label={`${project.title} portfolio`}>
        {images.map((image, index) => (
          <figure
            className={`artist-masonry-item artist-masonry-item-${(index % 7) + 1} image-frame`}
            key={index}
          >
            <Visual
              media={image}
              alt={`${project.title} image ${index + 1}`}
              sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
              variant={index + 1}
            />
          </figure>
        ))}
      </section>

      <section className="artist-info">
        <div>
          <h2>{project.title}</h2>
          {project.excerpt ? <p>{project.excerpt}</p> : null}
        </div>
        <div>
          <p className="eyebrow">Work / Bio / Contact</p>
          <Link href="/#contact">Bookings <Arrow /></Link>
        </div>
      </section>

      <footer className="footer compact-footer">
        <div className="footer-signoff">
          <p>Carla is model.</p>
          <p>Carla is movement.</p>
          <p>Come create with her.</p>
        </div>
        <div className="footer-bottom">
          <Link href="/#work">All work</Link>
          <span>© {new Date().getFullYear()} Carla Gorecka</span>
        </div>
      </footer>
    </main>
  )
}
