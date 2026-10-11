import Link from 'next/link'
import {
  HomepageMasonry,
  type HomepageMasonrySlot,
} from '@/components/HomepageMasonry'
import {
  getPortfolioData,
  photoshootOf,
  type MediaLike,
  type PhotoshootLike,
} from '@/lib/portfolio'

export const revalidate = 300

type PhotoshootGroup = {
  photoshoot: PhotoshootLike
  images: MediaLike[]
  slots: number
}

export default async function HomePage() {
  const { site, photoshoots, media } = await getPortfolioData()
  const instagram = site.instagram || 'https://www.instagram.com/carlagorecka/'
  const facts = (site.profileFacts || []).filter((fact) => fact.label && fact.value)

  const grouped = new Map<string, MediaLike[]>()

  for (const image of media) {
    const photoshoot = photoshootOf(image)
    if (!photoshoot?.id) continue

    const key = String(photoshoot.id)
    const images = grouped.get(key) || []
    images.push(image)
    grouped.set(key, images)
  }

  const groups: PhotoshootGroup[] = photoshoots
    .map((photoshoot) => {
      const images = photoshoot.id ? grouped.get(String(photoshoot.id)) || [] : []
      const slots = images.length >= 5 ? 5 : images.length >= 4 ? 4 : images.length

      return { photoshoot, images, slots }
    })
    .filter((group) => group.slots > 0)

  // Interleave photoshoots instead of placing five images from one shoot together.
  // Every slot gets the full shoot as its swap pool, but starts on a different image.
  const homeSlots: HomepageMasonrySlot[] = Array.from({ length: 5 }, (_, slotIndex) =>
    groups.flatMap((group) =>
      slotIndex < group.slots
        ? [{
            id: `${group.photoshoot.id ?? group.photoshoot.slug}-${slotIndex}`,
            photoshootSlug: group.photoshoot.slug,
            photoshootTitle: group.photoshoot.title,
            images: group.images.slice(0, 5),
            startIndex: slotIndex % Math.min(group.images.length, 5),
          }]
        : [],
    ),
  ).flat()

  return (
    <main className="site" id="top">
      <header className="header">
        <span className="header-spacer" aria-hidden="true" />
        <nav className="nav" aria-label="Primary navigation">
          <a href="#work">Work</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>
        <a className="menu-link" href={instagram} target="_blank" rel="noreferrer">Instagram</a>
      </header>

      <section className="masonry-section" id="work">
        <div className="masonry-stage">
          <h1 className="masonry-name" aria-label="Karo Gorecka">
            <span className="masonry-name__first">Karo</span>
            <span className="masonry-name__last">Gorecka</span>
          </h1>

          <HomepageMasonry slots={homeSlots} />
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
