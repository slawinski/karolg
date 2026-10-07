import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { Arrow } from '@/components/Arrow'
import { EditionMark } from '@/components/EditionMark'
import { Visual } from '@/components/Visual'
import {
  fallbackProjects,
  getPortfolioData,
  placeholderMedia,
  type MediaLike,
  type ProjectLike,
} from '@/lib/portfolio'

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

const padNumber = (value: number) => String(value).padStart(2, '0')

export default async function WorkPage({ params }: Props) {
  const { slug } = await params
  const project = await getProject(slug)
  if (!project) notFound()

  const { projects: orderedProjects } = await getPortfolioData()
  const editionIndex = orderedProjects.findIndex((candidate) => candidate.slug === slug)

  const gallery = (project.gallery?.filter((item) => typeof item === 'object') || []) as MediaLike[]
  const images: MediaLike[] = gallery.length ? gallery : placeholderMedia
  const rhythm = ['pull-a', 'pull-b', 'pull-c'] as const
  const year = new Date().getFullYear()

  return (
    <main className="sheet">
      <header className="rack-bar shell">
        <Link className="wordmark" href="/" aria-label="Carla Gorecka home">
          <span>CARLA</span>
          <span>GORECKA</span>
        </Link>
        <nav className="rack-nav" aria-label="Primary navigation">
          <Link href="/#work">Work</Link>
          <Link href="/#about">About</Link>
          <Link href="/#contact">Contact</Link>
        </nav>
        <Link className="rack-cta" href="/#work">
          Back to rack <Arrow />
        </Link>
        <details className="rack-menu">
          <summary aria-label="Open menu">Menu</summary>
          <nav aria-label="Mobile navigation">
            <Link href="/#work">Back to rack</Link>
            <Link href="/#about">About</Link>
            <Link href="/#contact">Contact</Link>
          </nav>
        </details>
      </header>

      <section className="sheet-hero shell">
        <EditionMark index={editionIndex >= 0 ? editionIndex : undefined} folio={`EDITION SHEET — ${project.category}`} note="LOCKED CHASE" />
        <h1 className="chase">
          {project.title
            .split(' ')
            .filter(Boolean)
            .map((word) => (
              <span className="chase-line" key={word}>
                <span className="chase-ink">{word}</span>
                <span className="chase-signal" aria-hidden="true">
                  {word}
                </span>
              </span>
            ))}
        </h1>
        {project.excerpt ? <p className="sheet-excerpt">{project.excerpt}</p> : null}
        <p className="sheet-meta">
          {project.category}
          {project.year ? ` — ${project.year}` : ''} — {images.length} PULL{images.length === 1 ? '' : 'S'} ON
          THE RACK
        </p>
      </section>

      <section className="sheet-rack shell" aria-label={`${project.title} pulls`}>
        {images.map((item, index) => (
          <figure className={`sheet-pull ${rhythm[index % rhythm.length]}`} key={index}>
            <div className="frame reveal">
              <Visual
                media={item}
                alt={`${project.title} pull ${index + 1}`}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 58vw"
                variant={index + 1}
                select={index === 1}
              />
            </div>
            <figcaption className="pull-note">
              <span>
                PULL {padNumber(index + 1)}/{padNumber(images.length)}
                {index === 1 ? ' — SELECT' : ''}
              </span>
              <span>REG ✓</span>
            </figcaption>
          </figure>
        ))}
      </section>

      <footer className="colophon shell">
        <p>© {year} Carla Gorecka</p>
        <p>
          {project.title} — pulled on paper, set in Anton
        </p>
        <Link href="/#work">
          Back to rack <Arrow />
        </Link>
      </footer>
    </main>
  )
}
