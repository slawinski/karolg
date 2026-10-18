import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ settings: vi.fn() }))
vi.mock('next/font/google', () => ({ Anton: () => ({ variable: 'font' }) }))
vi.mock('next/server', () => ({ connection: async () => {} }))
vi.mock('@/lib/portfolio', () => ({ getSiteSettings: mocks.settings }))

beforeEach(() => {
  mocks.settings.mockResolvedValue({})
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://carlagorecka.com')
})

describe('CMS social image metadata', () => {
  it('leaves image metadata unset for existing sites without a selection', async () => {
    const { generateMetadata } = await import('./layout')
    const metadata = await generateMetadata()
    expect(metadata.openGraph).toBeUndefined()
    expect(metadata.twitter).toBeUndefined()
    expect(metadata.title).toMatchObject({ default: 'Carla Gorecka — Model / Pilates / Creative' })
  })

  it.each(['image/jpeg', 'image/png'])('publishes %s as an absolute revisioned OG and Twitter image', async (mimeType) => {
    mocks.settings.mockResolvedValue({ socialImage: {
      kind: 'image', mimeType, url: '/api/media/file/social.jpg?v=3',
      width: 1200, height: 630, alt: 'Carla in the studio',
    } })
    const { generateMetadata } = await import('./layout')
    const metadata = await generateMetadata()
    const image = { url: 'https://carlagorecka.com/api/media/file/social.jpg?v=3',
      width: 1200, height: 630, alt: 'Carla in the studio' }
    expect(metadata.openGraph).toMatchObject({ images: [image] })
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image', images: [image] })
  })

  it.each([null, 12, { kind: 'video', mimeType: 'video/mp4', url: '/private.mov' },
    { kind: 'image', mimeType: 'image/webp', url: '/unsupported.webp' }])(
    'does not publish an unresolved or non-image selection: %j', async (socialImage) => {
      mocks.settings.mockResolvedValue({ socialImage })
      const { generateMetadata } = await import('./layout')
      expect((await generateMetadata()).openGraph).toBeUndefined()
    },
  )
})
