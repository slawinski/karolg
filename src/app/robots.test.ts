import { expect, it } from 'vitest'
import robots, { dynamic } from './robots'

it('keeps public robots static with expected crawler directives and sitemap', () => {
  expect(dynamic).toBe('force-static')
  expect(robots()).toEqual({
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/sitemap.xml`,
  })
})
