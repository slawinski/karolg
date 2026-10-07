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
  const chapters = pool.slice(0, 4)
  const instagram = site.instagram || 'https://www.instagram.com/carlagorecka/'
  const hero = site.heroMedia || placeholderMedia[1]
  const facts = (site.profileFacts || []).filter((fact) => fact.label && fact.value)

  return (
    <main className="site">
      <header className="header">
        <a className="brand" href="#top">Carla Gorecka</a>
        <nav className="nav" aria-label="Primary navigation">
          <a href="#work">Work</a>
          <a href="#profile">Profile</a>
          <a href="#contact">Contact</a>
        </nav>
        <a className="ig" href={instagram} target="_blank" rel="noreferrer">Instagram</a>
      </header>

      <section className="hero" id="top">
        <figure className="hero-media image-frame">
          <Visual media={hero} alt="Carla Gorecka portrait" priority sizes="100vw" />
        </figure>
        <div className="shade" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow">{site.roles}</p>
          <h1>
            <span>Carla</span>
            <span>Gorecka</span>
          </h1>
          <div className="hero-bottom">
            <p>{site.intro}</p>
            <a href="#work">Enter portfolio <Arrow /></a>
          </div>
        </div>
      </section>

      <section className="chapters" id="work">
        {chapters.map((project, index) => {
          const gallery = galleryOf(project)
          const image = project.cover || gallery[0] || placeholderMedia[index % placeholderMedia.length]
          return (
            <article className="chapter" key={project.slug}>
              <Link className="chapter-media image-frame" href={`/work/${project.slug}`}>
                <Visual
                  media={image}
                  alt={project.title}
                  sizes="100vw"
                  variant={index + 1}
                />
              </Link>
              <div className="chapter-shade" aria-hidden="true" />
              <div className="chapter-copy">
                <div className="chapter-index">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <span>{project.category}</span>
                </div>
                <h2>{project.title}</h2>
                <div className="chapter-foot">
                  <p>{project.excerpt}</p>
                  <Link href={`/work/${project.slug}`}>View story <Arrow /></Link>
                </div>
              </div>
            </article>
          )
        })}
      </section>

      <section className="profile" id="profile">
        <div className="profile-image image-frame">
          <Visual
            media={galleryOf(chapters[1] || fallbackProjects[1])[1] || placeholderMedia[0]}
            alt="Carla Gorecka movement portrait"
            sizes="(max-width: 760px) 100vw, 50vw"
          />
        </div>
        <div className="profile-copy">
          <p className="eyebrow">Profile</p>
          <h2>Presence in motion.</h2>
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
      </section>

      <section className="contact" id="contact">
        <p className="eyebrow">Bookings / collaborations</p>
        <h2>Carla Gorecka</h2>
        <div className="contact-links">
          {site.email ? <a href={`mailto:${site.email}`}>{site.email} <Arrow diagonal /></a> : null}
          <a href={instagram} target="_blank" rel="noreferrer">@carlagorecka <Arrow diagonal /></a>
        </div>
      </section>

      <footer className="footer">
        <p>© {new Date().getFullYear()} Carla Gorecka</p>
        <p>Model · Pilates · Creative</p>
        <a href="/admin">CMS</a>
      </footer>
    </main>
  )
}
