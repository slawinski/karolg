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
  const selected = pool.slice(0, 5)
  const instagram = site.instagram || 'https://www.instagram.com/carlagorecka/'
  const hero = site.heroMedia || placeholderMedia[1]

  return (
    <main className="site">
      <header className="header">
        <nav className="nav nav-left" aria-label="Primary navigation">
          <a href="#work">Work</a>
          <a href="#profile">Profile</a>
          <a href="#contact">Contact</a>
        </nav>
        <a className="brand-mini" href="#top">CG</a>
        <div className="nav nav-right">
          <a href={instagram} target="_blank" rel="noreferrer">Instagram</a>
          <a href="/admin">CMS</a>
        </div>
      </header>

      <section className="hero" id="top">
        <figure className="hero-media image-frame">
          <Visual media={hero} alt="Carla Gorecka" priority sizes="100vw" />
        </figure>
        <div className="hero-copy">
          <p className="hero-note">Model · Movement · Creative</p>
          <h1>Carla Gorecka</h1>
          <p className="hero-small">{site.intro}</p>
        </div>
      </section>

      <section className="season-intro">
        <p>Selected work</p>
        <h2>Portfolio 2026</h2>
      </section>

      <section className="campaigns" id="work">
        {selected.map((project, index) => {
          const gallery = galleryOf(project)
          const primary = project.cover || gallery[0] || placeholderMedia[index % placeholderMedia.length]
          const secondary = gallery[1] || placeholderMedia[(index + 1) % placeholderMedia.length]

          if (index === 0) {
            return (
              <Link className="campaign campaign-full" href={`/work/${project.slug}`} key={project.slug}>
                <figure className="image-frame">
                  <Visual media={primary} alt={project.title} sizes="100vw" variant={index + 1} />
                </figure>
                <div className="campaign-overlay">
                  <p>{project.category}</p>
                  <h3>{project.title}</h3>
                  <span>View story</span>
                </div>
              </Link>
            )
          }

          if (index === 1) {
            return (
              <section className="split-story" key={project.slug}>
                <Link className="split-main image-frame" href={`/work/${project.slug}`}>
                  <Visual media={primary} alt={project.title} sizes="(max-width: 760px) 100vw, 66vw" variant={index + 1} />
                  <div className="split-label">
                    <p>{project.category}</p>
                    <h3>{project.title}</h3>
                  </div>
                </Link>
                <Link className="split-side image-frame" href={`/work/${project.slug}`}>
                  <Visual media={secondary} alt={`${project.title} detail`} sizes="(max-width: 760px) 100vw, 34vw" variant={index + 2} />
                  <span className="side-caption">Explore</span>
                </Link>
              </section>
            )
          }

          if (index === 2) {
            return (
              <Link className="campaign campaign-letterbox" href={`/work/${project.slug}`} key={project.slug}>
                <figure className="image-frame">
                  <Visual media={primary} alt={project.title} sizes="100vw" variant={index + 1} />
                </figure>
                <div className="letterbox-title">
                  <span>{project.category}</span>
                  <h3>{project.title}</h3>
                  <Arrow />
                </div>
              </Link>
            )
          }

          return (
            <Link className={`campaign campaign-half campaign-half-${index}`} href={`/work/${project.slug}`} key={project.slug}>
              <figure className="image-frame">
                <Visual media={primary} alt={project.title} sizes="(max-width: 760px) 100vw, 50vw" variant={index + 1} />
              </figure>
              <div className="half-title">
                <p>{project.category}</p>
                <h3>{project.title}</h3>
              </div>
            </Link>
          )
        })}
      </section>

      <section className="profile" id="profile">
        <p className="eyebrow">Profile</p>
        <h2>{site.heroHeadline || 'A creative approach to modeling'}</h2>
        <div className="profile-grid">
          <p>{site.intro}</p>
          <p>{site.handwrittenLine}</p>
        </div>
      </section>

      <section className="contact" id="contact">
        <div>
          <p className="eyebrow">Bookings / collaborations</p>
          <h2>Carla Gorecka</h2>
        </div>
        <div className="contact-links">
          {site.email ? <a href={`mailto:${site.email}`}>{site.email} <Arrow diagonal /></a> : null}
          <a href={instagram} target="_blank" rel="noreferrer">@carlagorecka <Arrow diagonal /></a>
        </div>
      </section>

      <footer className="footer">
        <div>
          <a href="#work">Work</a>
          <a href="#profile">Profile</a>
          <a href="#contact">Contact</a>
        </div>
        <p>© {new Date().getFullYear()} Carla Gorecka</p>
      </footer>
    </main>
  )
}
