import Link from 'next/link'
import { Arrow } from '@/components/Arrow'
import { EditionMark } from '@/components/EditionMark'
import { RegistrationCross } from '@/components/RegistrationCross'
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
      editorial: 'EDITORIALS',
      campaign: 'CAMPAIGNS',
      personal: 'PERSONAL',
      movement: 'MOVEMENT',
      portrait: 'PORTRAITS',
    } as Record<string, string>
  )[value] || value.toUpperCase()

const galleryOf = (project: ProjectLike): MediaLike[] =>
  (project.gallery?.filter((item) => typeof item === 'object') || []) as MediaLike[]

const padNumber = (value: number) => String(value).padStart(2, '0')

export default async function HomePage() {
  const { site, projects } = await getPortfolioData()
  const pool = projects.length ? projects : fallbackProjects
  const editions = pool.slice(0, 4)
  const editionCountWord =
    (['ONE', 'TWO', 'THREE', 'FOUR'] as const)[editions.length - 1] ?? String(editions.length)
  const locations = (site.locations || []).filter((location) => location.label)
  const facts = (site.profileFacts || []).filter((fact) => fact.label && fact.value)
  const pressLines = (site.heroEyebrow || '').split('\n').filter(Boolean)
  const instagram = site.instagram || 'https://www.instagram.com/carlagorecka/'
  const year = new Date().getFullYear()

  return (
    <main className="wall">
      <header className="rack-bar shell">
        <a className="wordmark" href="#top" aria-label="Carla Gorecka home">
          <span>CARLA</span>
          <span>GORECKA</span>
        </a>

        <nav className="rack-nav" aria-label="Primary navigation">
          <a href="#top">Home</a>
          <a href="#work">Work</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>

        <a className="rack-cta" href={instagram} target="_blank" rel="noreferrer">
          Instagram <Arrow diagonal />
        </a>

        <details className="rack-menu">
          <summary aria-label="Open menu">Menu</summary>
          <nav aria-label="Mobile navigation">
            <a href="#work">Work</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </nav>
        </details>
      </header>

      <section className="chase-block shell" id="top" aria-label="Carla Gorecka portfolio">
        <div className="chase-left">
          <p className="folio-no">PROOF WALL — No. 01 / DRYING RACK</p>
          <h1 className="chase">
            <span className="chase-line">
              <span className="chase-ink">CARLA</span>
              <span className="chase-signal" aria-hidden="true">
                CARLA
              </span>
            </span>
            <span className="chase-line">
              <span className="chase-ink">GORECKA</span>
              <span className="chase-signal" aria-hidden="true">
                GORECKA
              </span>
            </span>
          </h1>
          <p className="roles">{site.roles}</p>
          <p className="hand-line">{site.handwrittenLine}</p>
          <a className="chase-link" href="#work">
            Explore the rack <Arrow />
          </a>
        </div>

        <figure className="chase-pull frame reveal">
          <Visual
            media={site.heroMedia}
            alt="Carla Gorecka portrait"
            priority
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 40vw"
            variant={2}
          />
        </figure>
        <p className="pull-note">
          <span>
            PULL 01 — DRYING{locations.length ? ` / ${locations.map((l) => l.label).join(' — ')}` : ''}
          </span>
          <span>REG ✓</span>
        </p>

        <p className="rack-cont">RACK CONTINUES — {editionCountWord} EDITION{editions.length === 1 ? '' : 'S'} BELOW</p>
      </section>

      <section className="rack shell" id="work" aria-label="Selected work">
        <div className="rack-head">
          <h2 className="chase">
            <span className="chase-line">
              <span className="chase-ink">THE RACK</span>
              <span className="chase-signal" aria-hidden="true">
                THE RACK
              </span>
            </span>
          </h2>
          <p>{editions.length} EDITION{editions.length === 1 ? '' : 'S'} — PULL IN ORDER</p>
        </div>

        {editions.map((project, index) => {
          const gallery = galleryOf(project)
          const keeper =
            (typeof project.cover === 'object' && project.cover) ||
            gallery[0] ||
            placeholderMedia[index % placeholderMedia.length]
          const variants: MediaLike[] = gallery.slice(0, 2)
          for (let i = variants.length; i < 2; i += 1) {
            variants.push(placeholderMedia[(index + i + 1) % placeholderMedia.length])
          }
          return (
            <article className="edition" id={`edition-${project.slug}`} key={`${project.slug}-${index}`}>
              <div className="ed-head">
                <RegistrationCross position="tl" />
                <RegistrationCross position="tr" />
                <EditionMark
                  index={index}
                  folio={`${categoryLabel(project.category)} — ${project.title}`}
                  note="KEEPER + 2 PULLS / 1 SELECT"
                />
              </div>

              <div className="ed-body">
                <figure className="ed-keeper">
                  <div className="frame reveal">
                    <Visual
                      media={keeper}
                      alt={project.title}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 92vw, 58vw"
                      variant={index + 2}
                    />
                  </div>
                  <h3 className="ed-title chase">{project.title}</h3>
                </figure>

                <div className="ed-side">
                  <div className="ed-variants">
                    {variants.map((variantMedia, variantIndex) => (
                      <figure key={variantIndex}>
                        <div className="frame reveal">
                          <Visual
                            media={variantMedia}
                            alt={`${project.title} variant pull ${variantIndex + 1}`}
                            sizes="(max-width: 640px) 48vw, (max-width: 1024px) 30vw, 18vw"
                            variant={index + variantIndex + 3}
                            select={variantIndex === 1}
                          />
                        </div>
                        <figcaption className="pull-note">
                          <span>
                            PULL {padNumber(variantIndex + 1)}
                            {variantIndex === 1 ? ' — SELECT' : ''}
                          </span>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                  <p className="ed-excerpt">{project.excerpt}</p>
                  <Link className="ed-link" href={`/work/${project.slug}`}>
                    Open edition <Arrow />
                  </Link>
                </div>
              </div>
            </article>
          )
        })}
      </section>

      <section className="press shell" id="about" aria-label="About Carla Gorecka">
        <div className="press-head">
          <span>PRESS SHEET</span>
          <span>SET SQUARE — READ TWICE</span>
        </div>
        <h2 className="chase">BODY-AWARE POINT OF VIEW</h2>
        <p className="lede">{site.intro}</p>

        <div className="press-grid">
          <dl className="facts">
            {facts.map((fact, index) => (
              <div key={`${fact.label}-${index}`}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
          <div>
            <ul className="press-lines">
              {pressLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="locales">
              {locations.map((location) => location.label).join(' — ')} — {site.handwrittenLine}
            </p>
          </div>
        </div>
      </section>

      <section className="final" id="contact" aria-label="Contact">
        <div className="shell">
          <EditionMark index={4} folio="BOOKINGS / COLLABORATIONS" note="FINAL PULL" />
          <h2 className="chase">
            {['LET’S', 'CREATE', 'TOGETHER'].map((word) => (
              <span className="chase-line" key={word}>
                <span className="chase-ink">{word}</span>
                <span className="chase-signal" aria-hidden="true">
                  {word}
                </span>
              </span>
            ))}
          </h2>
          <p className="final-sub">
            A body-aware point of view for fashion, movement and portraiture — Warsaw-based, working
            worldwide. Reach out and the next pull goes on the rack.
          </p>
          <div className="final-links">
            {site.email ? (
              <a href={`mailto:${site.email}`}>
                <span>{site.email}</span>
                <small>
                  EMAIL <Arrow diagonal />
                </small>
              </a>
            ) : null}
            <a href={instagram} target="_blank" rel="noreferrer">
              <span>@carlagorecka</span>
              <small>
                INSTAGRAM <Arrow diagonal />
              </small>
            </a>
          </div>
        </div>
      </section>

      <footer className="colophon shell">
        <p>© {year} Carla Gorecka</p>
        <p>Model · Pilates · Creative — pulled on paper, set in Anton</p>
        <a href="/admin">
          CMS <Arrow diagonal />
        </a>
      </footer>
    </main>
  )
}
