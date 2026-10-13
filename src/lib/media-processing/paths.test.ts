import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  derivativeRelativePath,
  normalizeRelativeMediaPath,
  resolveOwnedDerivativePath,
  validateOwnedDerivativePath,
} from './paths'

describe('generated derivative ownership', () => {
  it('names derivatives by immutable media ID and revision', () => {
    expect(derivativeRelativePath(42, 3, 'playback'))
      .toBe('generated/42/r3/playback.mp4')
    expect(derivativeRelativePath(42, 3, 'poster'))
      .toBe('generated/42/r3/poster.jpg')
  })

  it.each([
    '../secret',
    'generated/42/../secret',
    '/absolute/file',
    'C:\\absolute\\file',
    'generated\\42\\r1\\poster.jpg',
  ])('rejects unsafe relative path %s', (value) => {
    expect(() => normalizeRelativeMediaPath(value)).toThrow('Invalid relative media path')
  })

  it('only resolves derivatives owned by the requested record', () => {
    expect(validateOwnedDerivativePath(
      'generated/42/r3/poster.jpg',
      42,
      'poster',
    )).toMatchObject({ revision: 3, kind: 'poster' })
    expect(() => validateOwnedDerivativePath(
      'generated/41/r3/poster.jpg',
      42,
    )).toThrow('not owned')

    const resolved = resolveOwnedDerivativePath(
      'generated/42/r3/playback.mp4',
      42,
      'playback',
      '/tmp/media-root',
    )
    expect(resolved.absolutePath).toBe(
      path.join('/tmp/media-root', 'generated/42/r3/playback.mp4'),
    )
  })
})
