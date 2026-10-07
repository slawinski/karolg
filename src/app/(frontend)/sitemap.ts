import type { MetadataRoute } from 'next'
import { fallbackProjects, getPortfolioData } from '@/lib/portfolio'

export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const { projects } = await getPortfolioData().catch(() => ({ projects: fallbackProjects }))
  return [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    ...projects.map((project) => ({
      url: `${base}/work/${project.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ]
}
