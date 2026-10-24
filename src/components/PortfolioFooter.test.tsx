import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PortfolioFooter } from './PortfolioFooter'

describe('portfolio footer content', () => {
  it('delivers identity and navigation without hydration', () => {
    const html = renderToStaticMarkup(<PortfolioFooter name="Carla Gorecka" statement="Fashion in motion" instagram="https://instagram.com/carlagorecka/" locations="Warsaw / Worldwide" />)
    expect(html).toContain('Fashion in motion')
    expect(html).toContain('Carla Gorecka')
    for (const href of ['/#work', '/#about', '#top', 'https://instagram.com/carlagorecka/']) {
      expect(html).toContain(`href="${href}"`)
    }
    expect(html).toContain('Warsaw / Worldwide')
    expect(html).toContain(`© ${new Date().getFullYear()}`)
  })

  it.each([undefined, '', '   '])('omits an absent email (%s) while keeping Instagram', (email) => {
    const html = renderToStaticMarkup(<PortfolioFooter email={email} />)
    expect(html).not.toContain('mailto:')
    expect(html).toContain('Instagram')
    expect(html).toContain('CARLA GORECKA')
  })

  it('uses a configured trimmed email', () => {
    const html = renderToStaticMarkup(<PortfolioFooter email="  booking@example.com  " />)
    expect(html).toContain('href="mailto:booking@example.com"')
  })
})
