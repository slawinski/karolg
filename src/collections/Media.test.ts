import type { PayloadRequest } from 'payload'
import { describe, expect, it } from 'vitest'
import { Media } from './Media'

const endpoints = Array.isArray(Media.endpoints) ? Media.endpoints : []
const reprocessHandler = endpoints.find(
  (endpoint) => endpoint.path === '/:id/reprocess',
)?.handler

if (typeof reprocessHandler !== 'function') {
  throw new Error('Media reprocess endpoint is not configured')
}

const request = (
  id: string,
  payload: Record<string, unknown> = {},
) => ({
  user: { id: 1 },
  routeParams: { id },
  payload,
}) as unknown as PayloadRequest

describe('media reprocess endpoint', () => {
  it.each(['7abc', '0', '-1', '1.5', '9007199254740992'])(
    'rejects non-safe decimal ID %s',
    async (id) => {
      const response = await reprocessHandler(request(id))
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'Invalid media ID' })
    },
  )

  it('returns a stable conflict for an active revision', async () => {
    const response = await reprocessHandler(request('7', {
      findByID: async () => ({
        id: 7,
        kind: 'video',
        processingRevision: 4,
        processingStatus: 'processing',
      }),
    }))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      kind: 'video',
      status: 'already-processing',
      revision: 4,
    })
  })
})

describe('media metadata', () => {
  it('allows uploads without alt text and titles records by filename', () => {
    const altField = Media.fields.find(
      (field) => 'name' in field && field.name === 'alt',
    )

    expect(altField).toMatchObject({ name: 'alt', type: 'text' })
    expect(altField).not.toHaveProperty('required', true)
    expect(Media.admin?.useAsTitle).toBe('filename')
  })
})
