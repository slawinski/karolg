import Link from 'next/link'
import { Visual } from '@/components/Visual'
import { getPortfolioData } from '@/lib/portfolio'

export const revalidate = 300

export default async function HomePage() {
  const { site, projects, media } = await getPortfolioData()
  const instagram = site.instagram || 'https://www.instagram.com/carlagorecka/'
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
            <span>{String(media.length).padStart(2, '0')} images</span>
            <span>All</span>
          </div>
        </div>

        <div className="masonry-grid">
          {media.map((image, index) => (
            <figure
              className={`masonry-card masonry-card-${(index % 7) + 1}`}
              key={image.id ?? image.filename ?? index}
            >
              <div className="image-frame">
                <Visual
                  media={image}
                  alt={image.alt || `Carla Gorecka portfolio image ${index + 1}`}
                  sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
                  variant={index + 1}
                />
              </div>
              <figcaption className="masonry-caption">
                <span>{image.caption || image.alt || 'Portfolio'}</span>
                <span>{String(index + 1).padStart(2, '0')}</span>
              </figcaption>
            </figure>
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
          {projects.slice(0, 6).map((project) => (
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
