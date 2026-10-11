import type { MetadataRoute } from 'next'
import { getPortfolioData, type PhotoshootLike } from '@/lib/portfolio'

export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const { photoshoots } = await getPortfolioData().catch(() => ({
    photoshoots: [] as PhotoshootLike[],
  }))

  return [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    ...photoshoots.map((photoshoot) => ({
      url: `${base}/work/${photoshoot.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ]
}
