import { describe, expect, it } from 'vitest'
import {
  FALLBACK_INSTAGRAM_URL,
  instagramLabel,
  normalizeInstagramUrl,
} from './instagram'

describe('Instagram links', () => {
  it.each([undefined, null, '', ' ', 'not a URL', 'http://instagram.com/example', 'https://example.com/instagram.com/example'])(
    'falls back for an unsafe value: %s',
    (value) => {
      expect(normalizeInstagramUrl(value)).toBe(FALLBACK_INSTAGRAM_URL)
    },
  )

  it('normalizes a secure Instagram profile URL', () => {
    expect(normalizeInstagramUrl(' https://instagram.com/example '))
      .toBe('https://instagram.com/example')
  })

  it('extracts the profile handle for display', () => {
    expect(instagramLabel('https://www.instagram.com/example/')).toBe('@example')
    expect(instagramLabel('https://www.instagram.com/')).toBe('Instagram')
  })
})
