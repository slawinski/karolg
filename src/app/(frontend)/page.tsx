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
  const selected = pool.slice(0, 4)
  const instagram = site.instagram || 'https://www.instagram.com/carlagorecka/'
  const hero = site.heroMedia || placeholderMedia[1]
  const facts = (site.profileFacts || []).filter((fact) => fact.label && fact.value)

  return (
    <main className="site">
      <header className="header shell">
        <a className="brand" href="#top">Carla Gorecka</a>
        <nav className="nav" aria-label="Primary navigation">
          <a href="#work">Work</a>
          <a href="#about">Profile</a>
          <a href="#contact">Contact</a>
        </nav>
        <a className="ig" href={instagram} target="_blank" rel="noreferrer">Instagram</a>
      </header>

      <section className="hero" id="top">
        <figure className="hero-media image-frame">
          <Visual media={hero} alt="Carla Gorecka" priority sizes="100vw" />
        </figure>
        <div className="hero-title shell">
          <h1>
            <span>Carla</span>
            <span>Gorecka</span>
          </h1>
        </div>
        <div className="hero-caption shell">
          <p>{site.roles}</p>
          <p>{site.intro}</p>
        </div>
      </section>

      <section className="intro shell" id="about">
        <p className="eyebrow">Profile</p>
        <div className="intro-grid">
          <h2>{site.heroHeadline || 'A creative approach to modeling'}</h2>
          <div className="intro-copy">
            <p>{site.intro}</p>
            <dl className="facts">
              {facts.map((fact, index) => (
                <div key={`${fact.label}-${index}`}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="work shell" id="work">
        <div className="work-head">
          <p className="eyebrow">Selected work</p>
          <p>{selected.length} stories</p>
        </div>

        <div className="work-grid">
          {selected.map((project, index) => {
            const gallery = galleryOf(project)
            const image = project.cover || gallery[0] || placeholderMedia[index % placeholderMedia.length]
            return (
              <Link className={`work-item work-item-${index + 1}`} href={`/work/${project.slug}`} key={project.slug}>
                <figure className="image-frame">
                  <Visual
                    media={image}
                    alt={project.title}
                    sizes="(max-width: 760px) 100vw, 58vw"
                    variant={index + 1}
                  />
                </figure>
                <div className="work-label">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{project.title}</h3>
                    <p>{project.category}{project.year ? ` · ${project.year}` : ''}</p>
                  </div>
                  <Arrow />
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="statement">
        <div className="shell statement-inner">
          <p>{site.handwrittenLine}</p>
          <h2>Quiet images. Strong presence.</h2>
        </div>
      </section>

      <section className="contact shell" id="contact">
        <p className="eyebrow">Bookings / collaborations</p>
        <h2>Available for selected projects.</h2>
        <div className="contact-row">
          {site.email ? <a href={`mailto:${site.email}`}>{site.email} <Arrow diagonal /></a> : null}
          <a href={instagram} target="_blank" rel="noreferrer">@carlagorecka <Arrow diagonal /></a>
        </div>
      </section>

      <footer className="footer shell">
        <p>© {new Date().getFullYear()} Carla Gorecka</p>
        <a href="/admin">CMS</a>
      </footer>
    </main>
  )
}
