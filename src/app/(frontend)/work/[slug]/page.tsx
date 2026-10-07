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
  const images = gallery.length ? gallery : placeholderMedia

  return (
    <main className="story-page">
      <header className="header shell">
        <Link className="brand" href="/">Carla Gorecka</Link>
        <Link className="instagram" href="/#work">Back to work <Arrow /></Link>
      </header>

      <section className="story-head shell">
        <p className="kicker">{project.category}{project.year ? ` / ${project.year}` : ''}</p>
        <h1>{project.title}</h1>
        {project.excerpt ? <p>{project.excerpt}</p> : null}
      </section>

      <section className="story-gallery shell">
        {images.map((image, index) => (
          <figure className={`story-image story-image-${(index % 3) + 1} image-frame`} key={index}>
            <Visual
              media={image}
              alt={`${project.title} image ${index + 1}`}
              sizes="(max-width: 760px) 100vw, 68vw"
              variant={index + 1}
            />
          </figure>
        ))}
      </section>

      <footer className="footer shell">
        <Link href="/#work">Selected work</Link>
        <Link href="/#contact">Contact <Arrow /></Link>
      </footer>
    </main>
  )
}
