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

const categoryLabel = (value: string) =>
  (
    {
      editorial: 'Editorial',
      campaign: 'Campaign',
      personal: 'Personal',
      movement: 'Movement',
      portrait: 'Portrait',
    } as Record<string, string>
  )[value] || value

const galleryOf = (project: ProjectLike): MediaLike[] =>
  (project.gallery?.filter((item) => typeof item === 'object') || []) as MediaLike[]

export default async function HomePage() {
  const { site, projects } = await getPortfolioData()
  const pool = projects.length ? projects : fallbackProjects
  const featured = pool.slice(0, 4)
  const facts = (site.profileFacts || []).filter((fact) => fact.label && fact.value)
  const locations = (site.locations || []).filter((location) => location.label)
  const instagram = site.instagram || 'https://www.instagram.com/carlagorecka/'
  const hero = site.heroMedia || placeholderMedia[1]
  const secondary = galleryOf(featured[0] || fallbackProjects[0])[1] || placeholderMedia[2]
  const portrait = galleryOf(featured[2] || fallbackProjects[2])[0] || placeholderMedia[3]

  return (
    <main className="site">
      <header className="header shell">
        <a className="brand" href="#top" aria-label="Carla Gorecka home">
          Carla Gorecka
        </a>
        <nav className="nav" aria-label="Primary navigation">
          <a href="#work">Work</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>
        <a className="instagram" href={instagram} target="_blank" rel="noreferrer">
          Instagram <Arrow diagonal />
        </a>
      </header>

      <section className="hero shell" id="top">
        <div className="hero-copy">
          <p className="kicker">{site.roles}</p>
          <h1>
            <span>Carla</span>
            <span>Gorecka</span>
          </h1>
          <div className="hero-bottom">
            <p className="intro">{site.intro}</p>
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

        <figure className="hero-image image-frame">
          <Visual media={hero} alt="Carla Gorecka portrait" priority sizes="(max-width: 760px) 100vw, 58vw" />
        </figure>

        <div className="hero-side">
          <p>
            {locations.map((location) => location.label).join(' / ')}
          </p>
          <p>{site.handwrittenLine}</p>
        </div>
      </section>

      <section className="work shell" id="work">
        <div className="section-intro">
          <p className="kicker">Selected work</p>
          <h2>Portfolio</h2>
          <p>Fashion, portraiture and movement, edited as a sequence rather than a grid.</p>
        </div>

        <div className="work-list">
          {featured.map((project, index) => {
            const gallery = galleryOf(project)
            const image = project.cover || gallery[0] || placeholderMedia[index % placeholderMedia.length]
            const alt = gallery[1] || placeholderMedia[(index + 2) % placeholderMedia.length]
            return (
              <article className="work-row" key={project.slug}>
                <div className="work-meta">
                  <span className="work-no">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <p>{categoryLabel(project.category)}</p>
                    <h3>{project.title}</h3>
                    <p className="excerpt">{project.excerpt}</p>
                    <Link href={`/work/${project.slug}`}>
                      View story <Arrow />
                    </Link>
                  </div>
                </div>
                <Link className="work-image image-frame" href={`/work/${project.slug}`}>
                  <Visual
                    media={image}
                    alt={project.title}
                    sizes="(max-width: 760px) 100vw, 55vw"
                    variant={index + 1}
                  />
                </Link>
                <div className="work-thumb image-frame">
                  <Visual
                    media={alt}
                    alt={`${project.title} detail`}
                    sizes="(max-width: 760px) 38vw, 14vw"
                    variant={index + 2}
                  />
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="about shell" id="about">
        <div className="about-images">
          <figure className="about-large image-frame">
            <Visual media={portrait} alt="Carla Gorecka portrait" sizes="(max-width: 760px) 100vw, 42vw" />
          </figure>
          <figure className="about-small image-frame">
            <Visual media={secondary} alt="Carla Gorecka editorial detail" sizes="(max-width: 760px) 42vw, 18vw" />
          </figure>
        </div>
        <div className="about-copy">
          <p className="kicker">About</p>
          <h2>Body-aware, image-first.</h2>
          <p>{site.intro}</p>
          <p>
            The portfolio brings together modeling, movement and portraiture without separating them
            into different identities.
          </p>
          <dl className="facts about-facts">
            {facts.map((fact, index) => (
              <div key={`about-${fact.label}-${index}`}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="contact shell" id="contact">
        <p className="kicker">Bookings / collaborations</p>
        <h2>Let&apos;s make something memorable.</h2>
        <div className="contact-links">
          {site.email ? <a href={`mailto:${site.email}`}>{site.email} <Arrow diagonal /></a> : null}
          <a href={instagram} target="_blank" rel="noreferrer">@carlagorecka <Arrow diagonal /></a>
        </div>
      </section>

      <footer className="footer shell">
        <p>© {new Date().getFullYear()} Carla Gorecka</p>
        <p>Model · Pilates · Creative</p>
        <a href="/admin">CMS <Arrow diagonal /></a>
      </footer>
    </main>
  )
}
