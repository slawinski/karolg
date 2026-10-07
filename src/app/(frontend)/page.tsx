import Link from 'next/link'
import { Arrow } from '@/components/Arrow'
import { Visual } from '@/components/Visual'
import {
  fallbackProjects,
  getPortfolioData,
  placeholderMedia,
  type MediaLike,
  type ProjectLike,
} from '@/lib/portfolio'

export const revalidate = 300

const galleryOf = (project: ProjectLike): MediaLike[] =>
  (project.gallery?.filter((item) => typeof item === 'object') || []) as MediaLike[]

const labelFor = (value: string) =>
  (
    {
      editorial: 'Editorial',
      campaign: 'Campaign',
      personal: 'Personal',
      movement: 'Movement',
      portrait: 'Portrait',
    } as Record<string, string>
  )[value] || value

export default async function HomePage() {
  const { site, projects } = await getPortfolioData()
  const pool = projects.length ? projects : fallbackProjects
  const instagram = site.instagram || 'https://www.instagram.com/carlagorecka/'
  const facts = (site.profileFacts || []).filter((fact) => fact.label && fact.value)

  const masonryItems = pool.flatMap((project, projectIndex) => {
    const gallery = galleryOf(project)
    const media = [
      project.cover,
      ...gallery,
      placeholderMedia[projectIndex % placeholderMedia.length],
      placeholderMedia[(projectIndex + 2) % placeholderMedia.length],
    ].filter(Boolean) as MediaLike[]

    return media.slice(0, 4).map((image, imageIndex) => ({
      project,
      image,
      imageIndex,
    }))
  }).slice(0, 14)

  return (
    <main className="site">
      <header className="header">
        <a className="brand" href="#top">Carla Gorecka</a>
        <nav className="nav" aria-label="Primary navigation">
          <a href="#work">Work</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>
        <a className="menu-link" href={instagram} target="_blank" rel="noreferrer">Instagram</a>
      </header>

      <section className="intro-shell" id="top">
        <div className="intro-copy">
          <p className="eyebrow">{site.roles}</p>
          <h1>
            Carla is model.
            <br />
            Carla is movement.
            <br />
            Carla is creative.
          </h1>
        </div>
        <div className="intro-meta">
          <p>{site.intro}</p>
          <p>{site.handwrittenLine}</p>
        </div>
      </section>

      <section className="masonry-section" id="work">
        <div className="masonry-head">
          <h2>Work</h2>
          <div>
            <span>{String(masonryItems.length).padStart(2, '0')} images</span>
            <span>All</span>
          </div>
        </div>

        <div className="masonry-grid">
          {masonryItems.map(({ project, image, imageIndex }, index) => (
            <Link
              className={`masonry-card masonry-card-${(index % 7) + 1}`}
              href={`/work/${project.slug}`}
              key={`${project.slug}-${imageIndex}-${index}`}
            >
              <figure className="image-frame">
                <Visual
                  media={image}
                  alt={`${project.title} image ${imageIndex + 1}`}
                  sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
                  variant={index + 1}
                />
              </figure>
              <div className="masonry-caption">
                <span>{project.title}</span>
                <span>{labelFor(project.category)}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="about" id="about">
        <div className="about-statement">
          <p>Carla is model.</p>
          <p>Carla is movement.</p>
          <p>Carla is portraiture.</p>
          <p>Carla is presence.</p>
          <p>Come create together.</p>
        </div>

        <div className="about-detail">
          <div className="about-copy">
            <p>{site.intro}</p>
            <p>{site.handwrittenLine}</p>
          </div>
          <dl className="facts">
            {facts.map((fact, index) => (
              <div key={`${fact.label}-${index}`}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <footer className="footer" id="contact">
        <div className="footer-col">
          <h2>Work</h2>
          {pool.slice(0, 6).map((project) => (
            <Link href={`/work/${project.slug}`} key={project.slug}>{project.title}</Link>
          ))}
        </div>
        <div className="footer-col">
          <h2>Explore</h2>
          <a href="#about">About</a>
          <a href="#work">All work</a>
          <a href="/admin">CMS</a>
        </div>
        <div className="footer-col">
          <h2>Connect</h2>
          {site.email ? <a href={`mailto:${site.email}`}>{site.email}</a> : null}
          <a href={instagram} target="_blank" rel="noreferrer">@carlagorecka</a>
        </div>

        <div className="footer-signoff">
          <p>Carla is model.</p>
          <p>Carla is movement.</p>
          <p>Come create with her.</p>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Carla Gorecka</span>
          <span>Warsaw / Worldwide</span>
        </div>
      </footer>
    </main>
  )
}
