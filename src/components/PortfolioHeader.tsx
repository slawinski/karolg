type PortfolioHeaderProps = {
  instagram: string
}

export function PortfolioHeader({ instagram }: PortfolioHeaderProps) {
  return (
    <header className="header header--portfolio">
      <a className="menu-link" href={instagram} target="_blank" rel="noreferrer">
        Instagram
      </a>
    </header>
  )
}
