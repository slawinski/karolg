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

export default async function HomePage() {
  const { site, projects } = await getPortfolioData()
  const pool = projects.length ? projects : fallbackProjects
  const stories = pool.slice(0, 6)
  const instagram = site.instagram || 'https://www.instagram.com/carlagorecka/'
  const hero = site.heroMedia || placeholderMedia[1]
  const facts = (site.profileFacts || []).filter((fact) => fact.label && fact.value)

  return (
    <main className="site">
      <header className="header">
        <a className="brand" href="#top">Carla Gorecka</a>
        <nav className="nav" aria-label="Primary navigation">
          <a href="#work">Work</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>
        <a className="menu-link" href={instagram} target="_blank" rel="noreferrer">
          Instagram
        </a>
      </header>

      <section className="opening" id="top">
        <div className="opening-copy">
          <p className="eyebrow">{site.roles}</p>
          <h1>
            Carla is model.
            <br />
            Carla is movement.
            <br />
            Carla is creative.
          </h1>
          <p className="opening-intro">{site.intro}</p>
        </div>

        <figure className="opening-image image-frame">
          <Visual media={hero} alt="Carla Gorecka portrait" priority sizes="(max-width: 760px) 100vw, 56vw" />
        </figure>
      </section>

      <section className="news" id="work">
        <div className="section-label">
          <h2>Selected work</h2>
          <span>{String(stories.length).padStart(2, '0')} stories</span>
        </div>

        <div className="news-grid">
          {stories.map((project, index) => {
            const gallery = galleryOf(project)
            const image = project.cover || gallery[0] || placeholderMedia[index % placeholderMedia.length]
            return (
              <Link className={`news-item news-item-${index + 1}`} href={`/work/${project.slug}`} key={project.slug}>
                <figure className="image-frame">
                  <Visual
                    media={image}
                    alt={project.title}
                    sizes="(max-width: 760px) 100vw, 48vw"
                    variant={index + 1}
                  />
                </figure>
                <div className="news-meta">
                  <span>{project.category}</span>
                  <h3>{project.title}</h3>
                  <Arrow />
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="about" id="about">
        <div className="about-copy">
          <p className="about-line">Carla is model.</p>
          <p className="about-line">Carla is movement.</p>
          <p className="about-line">Carla is portraiture.</p>
          <p className="about-line">Carla is presence.</p>
          <p className="about-line">Come create together.</p>
        </div>

        <div className="about-detail">
          <div>
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
          {pool.slice(0, 5).map((project) => (
            <Link href={`/work/${project.slug}`} key={project.slug}>{project.title}</Link>
          ))}
        </div>
        <div className="footer-col">
          <h2>Explore</h2>
          <a href="#about">About</a>
          <a href="#work">Selected work</a>
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
