import { beforeEach, describe, expect, it, vi } from 'vitest'

const payload = vi.hoisted(() => ({
  find: vi.fn(),
  findGlobal: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))
vi.mock('payload', () => ({ getPayload: async () => payload }))

import {
  getPhotoshootBySlug,
  getPhotoshootMedia,
  getPortfolioData,
} from './portfolio'

const photographer = { id: 8, displayName: 'A. Camera' }
const photoshoot = {
  id: 4,
  title: 'Motion',
  slug: 'motion',
  photographers: [photographer],
}
const media = {
  id: 2,
  alt: 'Motion still',
  filename: 'motion.jpg',
  processingRevision: 2,
  url: '/api/media/file/motion.jpg',
  photoshoot,
}

beforeEach(() => {
  payload.find.mockReset()
  payload.findGlobal.mockReset()
  payload.findGlobal.mockResolvedValue({ name: 'Carla Gorecka' })
  payload.find.mockImplementation(async ({ collection, where }) => {
    if (collection === 'projects') return { docs: [photoshoot], hasNextPage: false }
    if (collection === 'media') return {
      docs: where ? [media] : [media],
      hasNextPage: false,
    }
    return { docs: [], hasNextPage: false }
  })
})

describe('public portfolio photographer attribution', () => {
  it('normalizes hero and collection identities through both loaders', async () => {
    payload.findGlobal.mockResolvedValue({ heroMedia: media })
    const result = await getPortfolioData()
    expect(result.site.heroMedia).toMatchObject({ url: '/api/media/file/motion.jpg?v=2' })
    expect(result.media[0]?.url).toBe('/api/media/file/motion.jpg?v=2')
    expect((await getPhotoshootMedia(4))[0]?.url).toBe('/api/media/file/motion.jpg?v=2')
    payload.findGlobal.mockResolvedValue({ heroMedia: 2 })
    expect((await getPortfolioData()).site.heroMedia).toBe(2)
  })
  it('loads expanded photographers on photoshoots and inherited media references', async () => {
    const result = await getPortfolioData()

    expect(result.photoshoots[0]?.photographers).toEqual([photographer])
    expect(result.media[0]?.photoshoot).toMatchObject({
      id: 4,
      photographers: [photographer],
    })
    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'projects',
      depth: 1,
    }))
    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'media',
      depth: 2,
      overrideAccess: false,
    }))
  })

  it('preserves expanded attribution in slug and media loaders', async () => {
    await expect(getPhotoshootBySlug('motion')).resolves.toMatchObject({
      id: 4,
      photographers: [photographer],
    })
    await expect(getPhotoshootMedia(4)).resolves.toEqual([
      expect.objectContaining({
        id: 2,
        photoshoot: expect.objectContaining({ photographers: [photographer] }),
      }),
    ])
    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'projects',
      depth: 1,
      where: { slug: { equals: 'motion' } },
    }))
  })
})
