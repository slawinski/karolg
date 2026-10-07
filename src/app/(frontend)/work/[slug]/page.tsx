import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { Arrow } from '@/components/Arrow'
import { Visual } from '@/components/Visual'
import { fallbackProjects, placeholderMedia, type MediaLike, type ProjectLike } from '@/lib/portfolio'

export const revalidate = 300
type Props = { params: Promise<{ slug: string }> }

async function getProject(slug: string): Promise<ProjectLike | null> {
  try {
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
      collection: 'projects',
      where: { slug: { equals: slug } },
      depth: 1,
      limit: 1,
    })
    return (result.docs[0] as unknown as ProjectLike) ||
      fallbackProjects.find((project) => project.slug === slug) || null
  } catch {
    return fallbackProjects.find((project) => project.slug === slug) || null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const project = await getProject(slug)
  return project ? { title: project.title, description: project.excerpt || undefined } : {}
}

export default async function WorkPage({ params }: Props) {
  const { slug } = await params
  const project = await getProject(slug)
  if (!project) notFound()

  const gallery = (project.gallery?.filter((item) => typeof item === 'object') || []) as MediaLike[]
  const images = gallery.length ? gallery : placeholderMedia
  const hero = project.cover || images[0]

  return (
    <main className="story-page">
      <header className="header">
        <Link className="nav-back" href="/#work">Back</Link>
        <Link className="brand-mini" href="/">CG</Link>
        <Link className="nav-back nav-back-right" href="/#contact">Contact</Link>
      </header>

      <section className="story-hero">
        <figure className="story-hero-media image-frame">
          <Visual media={hero} alt={project.title} priority sizes="100vw" />
        </figure>
        <div className="story-hero-copy">
          <p>{project.category}{project.year ? ` · ${project.year}` : ''}</p>
          <h1>{project.title}</h1>
        </div>
      </section>

      {project.excerpt ? (
        <section className="story-text">
          <p>{project.excerpt}</p>
        </section>
      ) : null}

      <section className="story-gallery">
        {images.map((image, index) => (
          <figure className={`story-frame story-frame-${(index % 4) + 1} image-frame`} key={index}>
            <Visual
              media={image}
              alt={`${project.title} image ${index + 1}`}
              sizes="(max-width: 760px) 100vw, 70vw"
              variant={index + 1}
            />
          </figure>
        ))}
      </section>

      <section className="story-end">
        <p>{project.title}</p>
        <Link href="/#work">Next / all work <Arrow /></Link>
      </section>
    </main>
  )
}
