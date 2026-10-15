import type { SanitizedPermissions } from 'payload'
import { describe, expect, it } from 'vitest'
import { canUpdatePhotoshoots, getRelationshipIDs } from './PhotoshootListCellUtils'

describe('PhotoshootListCells helpers', () => {
  it('normalizes populated and unpopulated has-many relationship values', () => {
    expect(getRelationshipIDs([1, '2', { id: 3 }, { value: '4' }, null])).toEqual([
      '1',
      '2',
      '3',
      '4',
    ])
  })

  it('only permits editing when Payload grants projects.update', () => {
    const allowed = {
      collections: { projects: { fields: true, update: true } },
    } as SanitizedPermissions
    const denied = {
      collections: { projects: { fields: true } },
    } as SanitizedPermissions

    expect(canUpdatePhotoshoots(allowed)).toBe(true)
    expect(canUpdatePhotoshoots(denied)).toBe(false)
    expect(canUpdatePhotoshoots()).toBe(false)
  })
})
