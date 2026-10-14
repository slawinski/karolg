import { HomepageMasonry } from '@/components/HomepageMasonry'
import { PortfolioHeader } from '@/components/PortfolioHeader'
import { composeHomepage } from '@/lib/homepage'
import { instagramLabel, normalizeInstagramUrl } from '@/lib/instagram'
import { getPortfolioData } from '@/lib/portfolio'

export const revalidate = 300

export default async function HomePage() {
  const { site, photoshoots, media } = await getPortfolioData()
  const instagram = normalizeInstagramUrl(site.instagram)
  const facts = (site.profileFacts || []).filter((fact) => fact.label && fact.value)
  const locations = (site.locations || [])
    .map((location) => location.label?.trim())
    .filter((location): location is string => Boolean(location))
  const locationLine = locations.join(' / ') || 'WARSAW / WORLDWIDE'
  const instagramHandle = instagramLabel(instagram)
  const configuredName = site.name?.trim() || 'Carla Gorecka'
  const displayName = configuredName === 'CARLA GORECKA' ? 'Carla Gorecka' : configuredName
  const [firstName, ...surnameParts] = displayName.split(/\s+/)
  const surname = surnameParts.join(' ')
  const intro = site.intro?.trim() || 'Model and classical Pilates teacher.'
  const homepage = composeHomepage(photoshoots, media)

  return (
    <main className="site" id="top">
      <PortfolioHeader instagram={instagram} />

      <section className="masonry-section" id="work">
        <div className="masonry-stage">
          <h1 className="masonry-name" aria-label={displayName}>
            <span className="masonry-name__first">{firstName}</span>{' '}
            {surname ? <span className="masonry-name__last">{surname}</span> : null}
          </h1>

          <HomepageMasonry pools={homepage.pools} slots={homepage.slots} />
        </div>
      </section>

      <section className="profile" id="about" aria-labelledby="profile-title">
        <div className="profile-folio" aria-hidden="true">
          <span>Profile</span>
          <span>01</span>
        </div>

        <h2 className="profile-title" id="profile-title">
          <span>{firstName}</span>
          {surname ? <span>{surname}.</span> : null}
        </h2>

        <div className="profile-copy">
          <p>{intro}</p>
        </div>

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

      <footer className="contact" id="contact">
        <div className="contact-meta">
          <span>For bookings and collaborations</span>
        </div>

        <a
          className="contact-handle"
          href={instagram}
          target="_blank"
          rel="noreferrer"
        >
          {instagramHandle}
        </a>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {displayName}</span>
          <span>{locationLine}</span>
          <a href="#top">Back to top</a>
        </div>
      </footer>
    </main>
  )
}
