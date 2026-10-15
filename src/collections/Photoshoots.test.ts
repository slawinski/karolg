import type { Access, PayloadRequest } from 'payload'
import { describe, expect, it } from 'vitest'
import { Media } from './Media'
import { Photoshoots } from './Photoshoots'

const fieldNamed = (collection: typeof Photoshoots, name: string) =>
  collection.fields.find((field) => 'name' in field && field.name === name)

const runAccess = async (access: Access | undefined, authenticated: boolean) => {
  if (typeof access !== 'function') throw new Error('Expected an access function')

  return access({
    req: { user: authenticated ? { id: 1 } : null } as unknown as PayloadRequest,
  })
}

describe('photoshoot photographer ownership', () => {
  it('owns a has-many photographer relationship rendered by the custom list cell', () => {
    const photographers = fieldNamed(Photoshoots, 'photographers')

    expect(photographers).toMatchObject({
      name: 'photographers',
      type: 'relationship',
      relationTo: 'photographers',
      hasMany: true,
      admin: {
        components: {
          Cell: '/components/admin/PhotoshootListCells#PhotographersCell',
        },
      },
    })
    expect(Photoshoots.admin?.defaultColumns).toContain('photographers')
    expect(fieldNamed(Media, 'photographers')).toBeUndefined()
  })

  it('allows public reads but requires authentication for every mutation', async () => {
    await expect(runAccess(Photoshoots.access?.read, false)).resolves.toBe(true)

    for (const operation of ['create', 'update', 'delete'] as const) {
      await expect(runAccess(Photoshoots.access?.[operation], false)).resolves.toBe(false)
      await expect(runAccess(Photoshoots.access?.[operation], true)).resolves.toBe(true)
    }
  })
})
