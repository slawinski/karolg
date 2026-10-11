import Link from 'next/link'
import { Visual } from '@/components/Visual'
import { getPortfolioData, photoshootOf } from '@/lib/portfolio'

export const revalidate = 300

export default async function HomePage() {
  const { site, photoshoots, featuredMedia } = await getPortfolioData()
  const instagram = site.instagram || 'https://www.instagram.com/carlagorecka/'
  const facts = (site.profileFacts || []).filter((fact) => fact.label && fact.value)
  const featured = featuredMedia
    .map((image) => ({ image, photoshoot: photoshootOf(image) }))
    .filter(
      (item): item is typeof item & { photoshoot: NonNullable<typeof item.photoshoot> } =>
        Boolean(item.photoshoot),
    )

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
            <span>{String(featured.length).padStart(2, '0')} featured</span>
            <span>Selected</span>
          </div>
        </div>

        <div className="masonry-grid">
          {featured.map(({ image, photoshoot }, index) => (
            <Link
              className={`masonry-card masonry-card-${(index % 7) + 1}`}
              href={`/work/${photoshoot.slug}`}
              key={image.id ?? image.filename ?? index}
            >
              <figure className="image-frame">
                <Visual
                  media={image}
                  alt={image.alt || `${photoshoot.title} featured image ${index + 1}`}
                  sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
                  variant={index + 1}
                />
              </figure>
              <div className="masonry-caption">
                <span>{photoshoot.title}</span>
                <span>{image.caption || photoshoot.year || 'View shoot'}</span>
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
          {photoshoots.slice(0, 6).map((photoshoot) => (
            <Link href={`/work/${photoshoot.slug}`} key={photoshoot.slug}>
              {photoshoot.title}
            </Link>
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
