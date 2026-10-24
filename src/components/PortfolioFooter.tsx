import Link from 'next/link'
import type { SiteLike } from '@/lib/portfolio'

type PortfolioFooterProps = Pick<SiteLike, 'name' | 'instagram' | 'email'> & {
  statement?: string | null
  locations?: string
}

export function PortfolioFooter({ name, statement, instagram, email, locations }: PortfolioFooterProps) {
  const identity = name?.trim() || 'CARLA GORECKA'
  const address = email?.trim()
  return <footer className="portfolio-footer" aria-label="Portfolio and contact">
    <div className="portfolio-footer__inner">
      <div className="portfolio-footer__main">
        <div className="portfolio-footer__statement">
          <p>{statement?.trim() || 'A CREATIVE APPROACH TO MODELING'}</p>
          <p className="portfolio-footer__location">{locations || 'Warsaw / Worldwide'}</p>
        </div>
        <nav className="portfolio-footer__links" aria-label="Explore">
          <h2>Explore</h2>
          <Link href="/#work">Selected work</Link>
          <Link href="/#about">Profile</Link>
          <a href="#top">Back to top <span aria-hidden="true">↑</span></a>
        </nav>
        <nav className="portfolio-footer__links" aria-label="Connect">
          <h2>Connect</h2>
          {address ? <a href={`mailto:${address}`}>Email</a> : null}
          <a href={instagram?.trim() || 'https://www.instagram.com/carlagorecka/'} target="_blank" rel="noopener noreferrer">Instagram <span aria-hidden="true">↗</span></a>
        </nav>
      </div>
      <div className="portfolio-footer__bottom">
        <p className="portfolio-footer__wordmark">{identity.split(/\s+/).map((word, index) => <span key={index}>{word}</span>)}</p>
        <p className="portfolio-footer__copyright">© {new Date().getFullYear()} {identity}</p>
      </div>
      <div className="portfolio-footer__shade" aria-hidden="true" />
    </div>
  </footer>
}
