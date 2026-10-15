import { HomepageMasonry } from '@/components/HomepageMasonry'
import { PortfolioHeader } from '@/components/PortfolioHeader'
import { composeHomepage } from '@/lib/homepage'
import { getPortfolioData } from '@/lib/portfolio'

export const revalidate = 300

export default async function HomePage() {
  const { site, photoshoots, media } = await getPortfolioData()
  const instagram = site.instagram || 'https://www.instagram.com/carlagorecka/'
  const facts = (site.profileFacts || []).filter((fact) => fact.label && fact.value)
  const locations = (site.locations || [])
    .map((location) => location.label?.trim())
    .filter((location): location is string => Boolean(location))
  const locationLine = locations.join(' / ') || 'WARSAW / WORLDWIDE'
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

      <section className="profile" id="about">
        <dl className="profile-facts">
          {facts.map((fact, index) => (
            <div key={`${fact.label}-${index}`}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
          <div>
            <dt>Location</dt>
            <dd>{locationLine}</dd>
          </div>
        </dl>
      </section>

      <footer className="site-footer">
        <span>© {new Date().getFullYear()} {site.name || 'Carla Gorecka'}</span>
        <span>{locationLine}</span>
        <a href="#top">Back to top</a>
      </footer>
    </main>
  )
}
