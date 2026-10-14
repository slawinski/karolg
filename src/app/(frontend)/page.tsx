import Link from 'next/link'
import { HomepageMasonry } from '@/components/HomepageMasonry'
import { PortfolioHeader } from '@/components/PortfolioHeader'
import { composeHomepage } from '@/lib/homepage'
import { getPortfolioData } from '@/lib/portfolio'

export const revalidate = 300

export default async function HomePage() {
  const { site, photoshoots, media } = await getPortfolioData()
  const instagram = site.instagram || 'https://www.instagram.com/carlagorecka/'
  const facts = (site.profileFacts || []).filter((fact) => fact.label && fact.value)
  const homepage = composeHomepage(photoshoots, media)

  return (
    <main className="site" id="top">
      <PortfolioHeader instagram={instagram} />

      <section className="masonry-section" id="work">
        <div className="masonry-stage">
          <h1 className="masonry-name" aria-label="Carla Gorecka">
            <span className="masonry-name__first">Carla</span>{' '}
            <span className="masonry-name__last">Gorecka</span>
          </h1>

          <HomepageMasonry pools={homepage.pools} slots={homepage.slots} />
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
