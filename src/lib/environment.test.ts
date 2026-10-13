import { describe, expect, it } from 'vitest'
import { boundedEnvironmentInteger, requirePayloadSecret } from './environment'

describe('configuration validation', () => {
  it.each([
    undefined,
    '',
    'short',
    'replace-with-at-least-32-random-characters',
    'development-only-change-me-please-do-not-use',
  ])('rejects an absent, weak, or placeholder Payload secret', (secret) => {
    expect(() => requirePayloadSecret(secret)).toThrow('PAYLOAD_SECRET')
  })

  it('accepts a sufficiently long non-placeholder secret', () => {
    const secret = '8f93d15cbb7a45c9a4f608b09fd19764'
    expect(requirePayloadSecret(secret)).toBe(secret)
  })

  it('uses bounded upload defaults and rejects unsafe overrides', () => {
    expect(boundedEnvironmentInteger('LIMIT', undefined, 10, 1, 20)).toBe(10)
    expect(() => boundedEnvironmentInteger('LIMIT', '21', 10, 1, 20))
      .toThrow('LIMIT')
  })
})
