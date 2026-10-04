import Link from 'next/link'
import { Arrow } from '@/components/Arrow'
import { Visual } from '@/components/Visual'
import { fallbackProjects, getPortfolioData } from '@/lib/portfolio'

export const revalidate = 300

const categoryLabel = (value: string) =>
  (
    {
      editorial: 'EDITORIALS',
      campaign: 'CAMPAIGNS',
      personal: 'PERSONAL',
      movement: 'MOVEMENT',
      portrait: 'PORTRAITS',
    } as Record<string, string>
  )[value] || value.toUpperCase()

export default async function HomePage() {
  const { site, projects } = await getPortfolioData()
  const firstThree = projects.slice(0, 3)
  const featured = projects.find((project) => project.featured) || projects[1] || fallbackProjects[1]
  const instagram = site.instagram || 'https://www.instagram.com/carlagorecka/'

  return (
    <main>
      <header className="site-header shell">
        <a className="wordmark compact" href="#top" aria-label="Carla Gorecka home">
          <span>CARLA</span>
          <span>GORECKA</span>
        </a>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <a className="active" href="#top">
            Home
          </a>
          <a href="#work">Work</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>

        <a className="header-cta" href={instagram} target="_blank" rel="noreferrer">
          Instagram <Arrow diagonal />
        </a>

        <details className="mobile-menu">
          <summary aria-label="Open menu">Menu</summary>
          <nav aria-label="Mobile navigation">
            <a href="#work">Work</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </nav>
        </details>
      </header>

      <section className="hero shell" id="top">
        <div className="hero-copy">
          <h1 className="wordmark">
            <span>CARLA</span>
            <span>GORECKA</span>
          </h1>
          <p className="roles">{site.roles}</p>
          <p className="scribble">{site.handwrittenLine}</p>

          <div className="hero-meta" id="about">
            <dl className="facts">
              {(site.profileFacts || []).map((fact, index) =>
                fact.label && fact.value ? (
                  <div key={`${fact.label}-${index}`}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ) : null,
              )}
            </dl>
            <div className="intro-block">
              <span className="rule" />
              <p>{site.intro}</p>
              <a href="#work">
                Explore work <Arrow />
              </a>
            </div>
          </div>
        </div>

        <div className="hero-image frame">
          <Visual
            media={site.heroMedia}
            alt="Carla Gorecka portrait"
            priority
            sizes="(max-width: 760px) 100vw, 52vw"
            variant={1}
          />
        </div>

        <aside className="acid-rail" aria-label="Portfolio themes">
          <div>
            {(site.locations || []).map((location, index) =>
              location.label ? <span key={`${location.label}-${index}`}>{location.label}</span> : null,
            )}
          </div>
          <div className="rail-copy">
            {(site.heroEyebrow || '').split('\n').map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
          <div className="rail-list">
            <span>Fashion</span>
            <span>Movement</span>
            <span>Portraits</span>
            <span>Personal</span>
          </div>
        </aside>
      </section>

      <section className="project-grid" id="work" aria-label="Selected work">
        {firstThree.map((project, index) => (
          <Link className="project-card" href={`/work/${project.slug}`} key={project.slug}>
            <div className="frame project-image">
              <Visual
                media={project.cover}
                alt={project.title}
                sizes="(max-width: 760px) 100vw, 33vw"
                variant={index + 2}
              />
            </div>
            <span className="project-index">0{index + 1}</span>
            <span className="project-title">{categoryLabel(project.category)}</span>
            <Arrow />
          </Link>
        ))}
      </section>

      <section className="feature-grid">
        <article className="feature-story">
          <div className="frame feature-image">
            <Visual
              media={featured.cover}
              alt={featured.title}
              sizes="(max-width: 900px) 100vw, 68vw"
              variant={5}
            />
          </div>
          <div className="feature-overlay">
            <p className="eyebrow">Featured story</p>
            <h2>
              IN
              <br />
              BETWEEN
            </h2>
            <p className="feature-description">
              {featured.excerpt || 'A visual story on movement, stillness and everyday beauty.'}
            </p>
            <Link href={`/work/${featured.slug}`}>
              View story <Arrow />
            </Link>
          </div>
        </article>

        <aside className="contact-card" id="contact">
          <div>
            <p className="eyebrow">Bookings / collaborations</p>
            <h2>
              LET&apos;S
              <br />
              CREATE
              <br />
              TOGETHER
            </h2>
          </div>
          <div className="contact-links">
            {site.email ? (
              <a href={`mailto:${site.email}`}>
                {site.email} <Arrow diagonal />
              </a>
            ) : null}
            <a href={instagram} target="_blank" rel="noreferrer">
              @carlagorecka <Arrow diagonal />
            </a>
          </div>
        </aside>
      </section>

      <section className="contact-sheet shell" aria-label="Portfolio contact sheet">
        {Array.from({ length: 9 }, (_, index) => (
          <div className="frame contact-thumb" key={index}>
            <Visual
              media={null}
              alt={`Portfolio preview ${index + 1}`}
              sizes="(max-width: 700px) 25vw, 12vw"
              variant={index + 1}
            />
          </div>
        ))}
      </section>

      <footer className="footer shell">
        <p>© {new Date().getFullYear()} Carla Gorecka</p>
        <p>Model · Pilates · Creative</p>
        <a href="/admin">
          CMS <Arrow diagonal />
        </a>
      </footer>
    </main>
  )
}
