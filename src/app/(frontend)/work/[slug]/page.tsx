import type { Metadata } from 'next'
import Link from 'next/link'
import {
  fallbackProjects,
  notFound } from 'next/navigation'
import { Arrow } from '@/components/Arrow'
import { Visual } from '@/components/Visual'
import { fallbackProjects,
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
  const images = gallery.length ? gallery : placeholderMedia

  return (
    <main className="story-page">
      <header className="header">
        <Link className="brand" href="/">Carla Gorecka</Link>
        <Link className="ig" href="/#work">Back <Arrow /></Link>
      </header>

      <section className="story-hero">
        <figure className="story-hero-media image-frame">
          <Visual
            media={project.cover || images[0]}
            alt={project.title}
            priority
            sizes="100vw"
          />
        </figure>
        <div className="story-hero-shade" aria-hidden="true" />
        <div className="story-hero-copy">
          <p className="eyebrow">{project.category}{project.year ? ` · ${project.year}` : ''}</p>
          <h1>{project.title}</h1>
          {project.excerpt ? <p>{project.excerpt}</p> : null}
        </div>
      </section>

      <section className="story-gallery">
        {images.map((image, index) => (
          <figure className={`story-frame story-frame-${(index % 2) + 1} image-frame`} key={index}>
            <Visual
              media={image}
              alt={`${project.title} image ${index + 1}`}
              sizes="100vw"
              variant={index + 1}
            />
            <figcaption>{String(index + 1).padStart(2,'0')} / {String(images.length).padStart(2,'0')}</figcaption>
          </figure>
        ))}
      </section>

      <footer className="footer">
        <Link href="/#work">Selected work</Link>
        <Link href="/#contact">Contact</Link>
      </footer>
    </main>
  )
}
