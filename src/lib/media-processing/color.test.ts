import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import {
  deriveTransitionColor,
  TRANSITION_COLOR_BACKGROUND,
} from './color'

describe('deriveTransitionColor', () => {
  it('returns normalized deterministic colors for generated image fixtures', async () => {
    const fixture = await sharp({
      create: {
        width: 48,
        height: 32,
        channels: 3,
        background: '#336699',
      },
    }).png().toBuffer()

    const first = await deriveTransitionColor(fixture)
    const second = await deriveTransitionColor(fixture)

    expect(first).toMatch(/^#[0-9a-f]{6}$/)
    expect(first).toBe('#336699')
    expect(second).toBe(first)
  })

  it('orients and flattens transparent pixels against the portfolio background', async () => {
    const fixture = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 0 },
      },
    }).png().toBuffer()

    expect(await deriveTransitionColor(fixture)).toBe(
      TRANSITION_COLOR_BACKGROUND,
    )
  })

  it('returns null for unreadable input', async () => {
    await expect(deriveTransitionColor(Buffer.from('not an image'))).resolves.toBeNull()
  })
})
