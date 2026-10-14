import { describe, expect, it } from 'vitest'
import {
  failurePatchForRevision,
  isCurrentVideoRevision,
} from './state'

describe('video processing revision state', () => {
  it('accepts only the current video revision', () => {
    expect(isCurrentVideoRevision({ kind: 'video', processingRevision: 3 }, 3)).toBe(true)
    expect(isCurrentVideoRevision({ kind: 'video', processingRevision: 4 }, 3)).toBe(false)
    expect(isCurrentVideoRevision({ kind: 'image', processingRevision: 3 }, 3)).toBe(false)
  })

  it('does not let an old failure overwrite a newer upload', () => {
    expect(failurePatchForRevision(
      { kind: 'video', processingRevision: 4 },
      3,
      new Error('old failure'),
    )).toBeNull()
    expect(failurePatchForRevision(
      { kind: 'video', processingRevision: 4 },
      4,
      new Error('current failure'),
    )).toEqual({
      processingStatus: 'failed',
      processingError: 'current failure',
    })
  })
})
