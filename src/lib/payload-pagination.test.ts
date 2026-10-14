import { describe, expect, it, vi } from 'vitest'
import { loadAllDocuments } from './payload-pagination'

describe('loadAllDocuments', () => {
  it('disables pagination and preserves collections larger than old fixed limits', async () => {
    const docs = Array.from({ length: 601 }, (_, id) => ({ id }))
    const load = vi.fn(async () => ({ docs }))

    await expect(loadAllDocuments(load)).resolves.toHaveLength(601)
    expect(load).toHaveBeenCalledWith({ pagination: false })
  })
})
