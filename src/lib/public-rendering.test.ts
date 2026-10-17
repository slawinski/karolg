import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ connection: vi.fn(), portfolio: vi.fn(), photoshoot: vi.fn(), media: vi.fn() }))
vi.mock('next/server', () => ({ connection: mocks.connection }))
vi.mock('./portfolio', () => ({
  getPortfolioData: mocks.portfolio,
  getSiteSettings: async () => ({}),
  getPhotoshoots: async () => [],
  getPhotoshootBySlug: mocks.photoshoot,
  getPhotoshootMedia: mocks.media,
  mediaUrl: () => null,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.connection.mockResolvedValue(undefined)
  mocks.portfolio.mockResolvedValue({ site: {}, photoshoots: [], media: [] })
  mocks.photoshoot.mockResolvedValue({ id: 4, title: 'Fixture' })
  mocks.media.mockResolvedValue([])
})

describe('fresh public rendering', () => {
  it('waits for the request boundary', async () => {
    const { awaitPublicRequest } = await import('./public-rendering')
    await awaitPublicRequest()
    expect(mocks.connection).toHaveBeenCalledTimes(1)
  })

  it.each(['home', 'work', 'metadata'])('does not read CMS data before the %s request boundary', async (route) => {
    let release!: () => void
    mocks.connection.mockReturnValue(new Promise<void>((resolve) => { release = resolve }))
    const Home = (await import('../app/(frontend)/page')).default
    const Work = await import('../app/(frontend)/work/[slug]/page')
    const props = { params: Promise.resolve({ slug: 'fixture' }) }
    const rendering = route === 'home' ? Home() : route === 'work' ? Work.default(props) : Work.generateMetadata(props)
    await Promise.resolve()
    expect(mocks.portfolio).not.toHaveBeenCalled()
    expect(mocks.photoshoot).not.toHaveBeenCalled()
    expect(mocks.media).not.toHaveBeenCalled()
    release()
    await rendering
    expect(route === 'home' ? mocks.portfolio : mocks.photoshoot).toHaveBeenCalled()
  })

  it('propagates a failed boundary without reading stale data', async () => {
    mocks.connection.mockRejectedValue(new Error('request unavailable'))
    const Home = (await import('../app/(frontend)/page')).default
    await expect(Home()).rejects.toThrow('request unavailable')
    expect(mocks.portfolio).not.toHaveBeenCalled()
  })
})
