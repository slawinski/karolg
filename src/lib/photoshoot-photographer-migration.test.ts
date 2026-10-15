import { describe, expect, it } from 'vitest'
import {
  assertCompatibleExistingAssignments,
  assertCompatibleExistingMediaAssignments,
  assertRollbackRepresentable,
  fanOutPhotoshootAttributions,
  mediaAttributionsFromRows,
  preflightPhotographerTransfer,
  type MediaRelationRow,
} from '../migrations/20261015_093016_photoshoot_photographers_schema'

const relation = (
  relationId: number,
  mediaId: number,
  photoshootId: number | null,
  photographerId: number,
  overrides: Partial<MediaRelationRow> = {},
): MediaRelationRow => ({
  relation_id: relationId,
  relation_path: 'photographers',
  media_id: mediaId,
  joined_media_id: mediaId,
  photoshoot_id: photoshootId,
  joined_photoshoot_id: photoshootId,
  photographer_id: photographerId,
  joined_photographer_id: photographerId,
  ...overrides,
})

describe('photoshoot photographer migration preflight', () => {
  it('canonicalizes matching nonempty media sets into photoshoot assignments', () => {
    const assignments = preflightPhotographerTransfer([
      relation(1, 10, 100, 3),
      relation(2, 10, 100, 2),
      relation(3, 11, 100, 2),
      relation(4, 11, 100, 3),
      relation(5, 20, 200, 8),
      relation(6, 20, 200, 8),
    ])

    expect(assignments).toEqual([
      { photoshootId: 100, photographerIds: [2, 3] },
      { photoshootId: 200, photographerIds: [8] },
    ])
  })

  it('rejects conflicting nonempty sets instead of unioning them', () => {
    expect(() =>
      preflightPhotographerTransfer([
        relation(1, 10, 100, 2),
        relation(2, 11, 100, 3),
      ]),
    ).toThrow(/photoshoot ID 100.*media 10=\[2\].*media 11=\[3\]/)
  })

  it('rejects orphaned relations with the affected IDs', () => {
    expect(() =>
      preflightPhotographerTransfer([
        relation(7, 42, 100, 9, {
          joined_media_id: null,
          joined_photographer_id: null,
        }),
      ]),
    ).toThrow(/orphaned.*relation IDs \[7\].*media IDs \[42\]/)
  })

  it('rejects malformed attributed rows with the relation ID', () => {
    expect(() =>
      preflightPhotographerTransfer([
        relation(10, 42, 100, 9, { photographer_id: null }),
      ]),
    ).toThrow(/malformed photographer relation IDs \[10\]/)
  })

  it('rejects attributed media without a photoshoot', () => {
    expect(() => preflightPhotographerTransfer([relation(8, 43, null, 9)])).toThrow(
      /without a photoshoot.*media IDs \[43\].*relation IDs \[8\]/,
    )
  })

  it('rejects non-photographer paths before media_rels can be dropped', () => {
    expect(() =>
      preflightPhotographerTransfer([
        relation(9, 44, 101, 9, { relation_path: 'unrelated' }),
      ]),
    ).toThrow(/non-photographer paths.*relation 9="unrelated"/)
  })

  it('rejects existing photoshoot assignments that conflict with media assignments', () => {
    expect(() =>
      assertCompatibleExistingAssignments(
        [{ photoshootId: 100, photographerIds: [2] }],
        [{ photoshootId: 100, photographerIds: [3] }],
      ),
    ).toThrow(/existing photoshoot assignments conflict.*100:3.*100:2/)

    expect(() =>
      assertCompatibleExistingAssignments(
        [{ photoshootId: 100, photographerIds: [2, 3] }],
        [{ photoshootId: 100, photographerIds: [3, 2] }],
      ),
    ).not.toThrow()
  })
})

describe('photoshoot photographer migration down plan', () => {
  it('fans each photoshoot assignment back to every media item in that photoshoot', () => {
    expect(
      fanOutPhotoshootAttributions(
        [
          { photoshootId: 100, photographerIds: [3, 2] },
          { photoshootId: 200, photographerIds: [8] },
        ],
        [
          { media_id: 12, photoshoot_id: 100 },
          { media_id: 10, photoshoot_id: 100 },
          { media_id: 11, photoshoot_id: 200 },
          { media_id: 13, photoshoot_id: null },
        ],
      ),
    ).toEqual([
      { mediaId: 10, photographerIds: [2, 3] },
      { mediaId: 11, photographerIds: [8] },
      { mediaId: 12, photographerIds: [2, 3] },
    ])
  })

  it('rejects rollback when an attributed photoshoot has no media', () => {
    expect(() =>
      assertRollbackRepresentable(
        [{ photoshootId: 100, photographerIds: [2] }],
        [{ media_id: 11, photoshoot_id: 200 }],
      ),
    ).toThrow(/photoshoots without media \[100\]/)
  })

  it('rejects rollback over conflicting existing media assignments', () => {
    const existing = mediaAttributionsFromRows([relation(1, 10, 100, 3)])
    expect(() =>
      assertCompatibleExistingMediaAssignments(
        [{ mediaId: 10, photographerIds: [2] }],
        existing,
      ),
    ).toThrow(/existing media assignments conflict.*10:3.*10:2/)

    expect(() =>
      assertCompatibleExistingMediaAssignments(
        [{ mediaId: 10, photographerIds: [3] }],
        existing,
      ),
    ).not.toThrow()
  })
})
