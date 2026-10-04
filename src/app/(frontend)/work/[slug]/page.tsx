import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { Arrow } from '@/components/Arrow'
import { Visual } from '@/components/Visual'
import { fallbackProjects, type MediaLike, type ProjectLike } from '@/lib/portfolio'

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
    return (
      (result.docs[0] as unknown as ProjectLike) ||
      fallbackProjects.find((project) => project.slug === slug) ||
      null
    )
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
  const images: Array<MediaLike | null> = gallery.length
    ? gallery
    : Array.from({ length: 5 }, () => null)

  return (
    <main className="work-page">
      <header className="work-header shell">
        <Link className="wordmark compact" href="/">
          <span>CARLA</span>
          <span>GORECKA</span>
        </Link>
        <Link href="/#work">
          Back to work <Arrow />
        </Link>
      </header>

      <section className="work-hero shell">
        <p className="eyebrow">{project.category}</p>
        <h1>{project.title}</h1>
        <p>{project.excerpt}</p>
      </section>

      <section className="work-gallery shell">
        {images.map((item, index) => (
          <figure className={`frame gallery-item gallery-item-${(index % 3) + 1}`} key={index}>
            <Visual
              media={item}
              alt={`${project.title} image ${index + 1}`}
              sizes="(max-width: 760px) 100vw, 60vw"
              variant={index + 1}
            />
          </figure>
        ))}
      </section>

      <footer className="footer shell">
        <Link href="/">Home</Link>
        <a href="https://www.instagram.com/carlagorecka/" target="_blank" rel="noreferrer">
          Instagram <Arrow diagonal />
        </a>
      </footer>
    </main>
  )
}
