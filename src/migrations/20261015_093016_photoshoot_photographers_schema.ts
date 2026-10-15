import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-sqlite'
import { sql } from '@payloadcms/db-sqlite'

type MigrationDB = MigrateUpArgs['db']

export type MediaRelationRow = {
  relation_id: unknown
  relation_path: unknown
  media_id: unknown
  joined_media_id: unknown
  photoshoot_id: unknown
  joined_photoshoot_id: unknown
  photographer_id: unknown
  joined_photographer_id: unknown
}

export type ProjectRelationRow = {
  relation_id: unknown
  relation_path: unknown
  photoshoot_id: unknown
  joined_photoshoot_id: unknown
  photographer_id: unknown
  joined_photographer_id: unknown
}

export type PhotoshootAttribution = {
  photoshootId: number
  photographerIds: number[]
}

export type MediaAttribution = {
  mediaId: number
  photographerIds: number[]
}

type MediaRow = {
  media_id: unknown
  photoshoot_id: unknown
}

const id = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : null

const rowLabel = (relationID: unknown) =>
  id(relationID) === null ? String(relationID ?? 'unknown') : String(relationID)

const sorted = (values: Iterable<number>) => [...new Set(values)].sort((a, b) => a - b)

const formatIDs = (values: Iterable<number>) => sorted(values).join(', ')

const sameIDs = (left: readonly number[], right: readonly number[]) =>
  left.length === right.length && left.every((value, index) => value === right[index])

/**
 * Validates and groups the legacy per-media relations without merging differing
 * nonempty photographer sets from media in the same photoshoot.
 */
export function preflightPhotographerTransfer(
  rows: readonly MediaRelationRow[],
): PhotoshootAttribution[] {
  const errors: string[] = []
  const malformedRelations: string[] = []
  const orphanedRelations: string[] = []
  const orphanedMedia = new Set<number>()
  const orphanedPhotographers = new Set<number>()
  const orphanedPhotoshoots = new Set<number>()
  const mediaWithoutPhotoshoot = new Set<number>()
  const noPhotoshootRelations: string[] = []
  const otherPaths: Array<{ id: string; path: string }> = []
  const mediaSets = new Map<number, { photoshootId: number; photographerIds: Set<number> }>()

  for (const row of rows) {
    const relationLabel = rowLabel(row.relation_id)
    if (row.relation_path !== 'photographers') {
      otherPaths.push({ id: relationLabel, path: String(row.relation_path ?? 'null') })
      continue
    }

    const relationId = id(row.relation_id)
    const mediaId = id(row.media_id)
    const photographerId = id(row.photographer_id)
    if (relationId === null || mediaId === null || photographerId === null) {
      malformedRelations.push(relationLabel)
      continue
    }

    if (id(row.joined_media_id) !== mediaId) {
      orphanedRelations.push(relationLabel)
      orphanedMedia.add(mediaId)
      continue
    }

    const photoshootId = id(row.photoshoot_id)
    if (photoshootId === null) {
      mediaWithoutPhotoshoot.add(mediaId)
      noPhotoshootRelations.push(relationLabel)
      continue
    }

    let orphaned = false
    if (id(row.joined_photographer_id) !== photographerId) {
      orphanedPhotographers.add(photographerId)
      orphaned = true
    }
    if (id(row.joined_photoshoot_id) !== photoshootId) {
      orphanedPhotoshoots.add(photoshootId)
      orphaned = true
    }
    if (orphaned) {
      orphanedRelations.push(relationLabel)
      continue
    }

    const existing = mediaSets.get(mediaId)
    if (existing) {
      existing.photographerIds.add(photographerId)
    } else {
      mediaSets.set(mediaId, {
        photoshootId,
        photographerIds: new Set([photographerId]),
      })
    }
  }

  if (malformedRelations.length > 0) {
    errors.push(`malformed photographer relation IDs [${malformedRelations.join(', ')}]`)
  }
  if (orphanedRelations.length > 0) {
    const details = [
      `relation IDs [${orphanedRelations.join(', ')}]`,
      orphanedMedia.size > 0 ? `media IDs [${formatIDs(orphanedMedia)}]` : '',
      orphanedPhotographers.size > 0
        ? `photographer IDs [${formatIDs(orphanedPhotographers)}]`
        : '',
      orphanedPhotoshoots.size > 0
        ? `photoshoot IDs [${formatIDs(orphanedPhotoshoots)}]`
        : '',
    ].filter(Boolean)
    errors.push(`orphaned photographer relations (${details.join('; ')})`)
  }
  if (mediaWithoutPhotoshoot.size > 0) {
    errors.push(
      `attributed media without a photoshoot (media IDs [${formatIDs(mediaWithoutPhotoshoot)}]; relation IDs [${noPhotoshootRelations.join(', ')}])`,
    )
  }
  if (otherPaths.length > 0) {
    errors.push(
      `media_rels contains non-photographer paths that would be dropped (${otherPaths
        .map((row) => `relation ${row.id}=${JSON.stringify(row.path)}`)
        .join(', ')})`,
    )
  }

  const mediaByPhotoshoot = new Map<
    number,
    Array<{ mediaId: number; photographerIds: number[] }>
  >()
  for (const [mediaId, attribution] of mediaSets) {
    const media = mediaByPhotoshoot.get(attribution.photoshootId) ?? []
    media.push({ mediaId, photographerIds: sorted(attribution.photographerIds) })
    mediaByPhotoshoot.set(attribution.photoshootId, media)
  }

  const assignments: PhotoshootAttribution[] = []
  for (const [photoshootId, media] of mediaByPhotoshoot) {
    media.sort((left, right) => left.mediaId - right.mediaId)
    const canonical = media[0]?.photographerIds ?? []
    if (media.some((item) => !sameIDs(item.photographerIds, canonical))) {
      errors.push(
        `photoshoot ID ${photoshootId} has conflicting nonempty photographer sets (${media
          .map((item) => `media ${item.mediaId}=[${item.photographerIds.join(', ')}]`)
          .join('; ')})`,
      )
      continue
    }
    assignments.push({ photoshootId, photographerIds: canonical })
  }

  if (errors.length > 0) {
    throw new Error(`Photographer migration preflight failed: ${errors.join('; ')}`)
  }

  return assignments.sort((left, right) => left.photoshootId - right.photoshootId)
}

export function preflightPhotoshootAttributions(
  rows: readonly ProjectRelationRow[],
): PhotoshootAttribution[] {
  const errors: string[] = []
  const assignments = new Map<number, Set<number>>()

  for (const row of rows) {
    const relationLabel = rowLabel(row.relation_id)
    if (row.relation_path !== 'photographers') {
      errors.push(
        `projects_rels relation ${relationLabel} has non-photographer path ${JSON.stringify(String(row.relation_path ?? 'null'))} that would be dropped`,
      )
      continue
    }

    const relationId = id(row.relation_id)
    const photoshootId = id(row.photoshoot_id)
    const photographerId = id(row.photographer_id)
    if (relationId === null || photoshootId === null || photographerId === null) {
      errors.push(`malformed projects_rels photographer relation ID ${relationLabel}`)
      continue
    }
    if (
      id(row.joined_photoshoot_id) !== photoshootId ||
      id(row.joined_photographer_id) !== photographerId
    ) {
      errors.push(
        `orphaned projects_rels relation ID ${relationId} (photoshoot ID ${photoshootId}; photographer ID ${photographerId})`,
      )
      continue
    }

    const photographers = assignments.get(photoshootId) ?? new Set<number>()
    photographers.add(photographerId)
    assignments.set(photoshootId, photographers)
  }

  if (errors.length > 0) {
    throw new Error(`Photographer migration preflight failed: ${errors.join('; ')}`)
  }

  return [...assignments]
    .map(([photoshootId, photographerIds]) => ({
      photoshootId,
      photographerIds: sorted(photographerIds),
    }))
    .sort((left, right) => left.photoshootId - right.photoshootId)
}

export function fanOutPhotoshootAttributions(
  assignments: readonly PhotoshootAttribution[],
  media: readonly MediaRow[],
): MediaAttribution[] {
  const byPhotoshoot = new Map(
    assignments.map((assignment) => [assignment.photoshootId, assignment.photographerIds]),
  )

  return media
    .flatMap((row) => {
      const mediaId = id(row.media_id)
      const photoshootId = id(row.photoshoot_id)
      if (mediaId === null || photoshootId === null) return []
      const photographerIds = byPhotoshoot.get(photoshootId)
      return photographerIds ? [{ mediaId, photographerIds: sorted(photographerIds) }] : []
    })
    .sort((left, right) => left.mediaId - right.mediaId)
}

export function mediaAttributionsFromRows(
  rows: readonly MediaRelationRow[],
): MediaAttribution[] {
  preflightPhotographerTransfer(rows)
  const assignments = new Map<number, Set<number>>()

  for (const row of rows) {
    if (row.relation_path !== 'photographers') continue
    const mediaId = id(row.media_id)
    const photographerId = id(row.photographer_id)
    if (mediaId === null || photographerId === null) continue
    const photographers = assignments.get(mediaId) ?? new Set<number>()
    photographers.add(photographerId)
    assignments.set(mediaId, photographers)
  }

  return [...assignments]
    .map(([mediaId, photographerIds]) => ({
      mediaId,
      photographerIds: sorted(photographerIds),
    }))
    .sort((left, right) => left.mediaId - right.mediaId)
}

export function assertRollbackRepresentable(
  assignments: readonly PhotoshootAttribution[],
  media: readonly MediaRow[],
) {
  const photoshootsWithMedia = new Set(
    media
      .map((row) => id(row.photoshoot_id))
      .filter((photoshootId): photoshootId is number => photoshootId !== null),
  )
  const missing = assignments
    .filter((assignment) => !photoshootsWithMedia.has(assignment.photoshootId))
    .map((assignment) => assignment.photoshootId)

  if (missing.length > 0) {
    throw new Error(
      `Cannot roll back photographer attribution: photoshoots without media [${formatIDs(missing)}] have no legacy attribution target`,
    )
  }
}

const tableExists = async (db: MigrationDB, table: string) => {
  const rows = await db.all(sql`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name = ${table}
    LIMIT 1
  `)
  return rows.length > 0
}

const assertColumns = async (db: MigrationDB, table: string, expected: string[]) => {
  const rows = (await db.all(sql`SELECT name FROM pragma_table_info(${table})`)) as Array<{
    name: string
  }>
  const columns = new Set(rows.map((row) => row.name))
  const missing = expected.filter((column) => !columns.has(column))
  if (missing.length > 0) {
    throw new Error(`${table} is missing required columns: ${missing.join(', ')}`)
  }
}

const readMediaRelations = async (db: MigrationDB) =>
  (await db.all(sql`
    SELECT
      media_rels.id AS relation_id,
      media_rels.path AS relation_path,
      media_rels.parent_id AS media_id,
      media.id AS joined_media_id,
      media.photoshoot_id AS photoshoot_id,
      projects.id AS joined_photoshoot_id,
      media_rels.photographers_id AS photographer_id,
      photographers.id AS joined_photographer_id
    FROM media_rels
    LEFT JOIN media ON media.id = media_rels.parent_id
    LEFT JOIN projects ON projects.id = media.photoshoot_id
    LEFT JOIN photographers ON photographers.id = media_rels.photographers_id
    ORDER BY media_rels.id
  `)) as MediaRelationRow[]

const readProjectRelations = async (db: MigrationDB) =>
  (await db.all(sql`
    SELECT
      projects_rels.id AS relation_id,
      projects_rels.path AS relation_path,
      projects_rels.parent_id AS photoshoot_id,
      projects.id AS joined_photoshoot_id,
      projects_rels.photographers_id AS photographer_id,
      photographers.id AS joined_photographer_id
    FROM projects_rels
    LEFT JOIN projects ON projects.id = projects_rels.parent_id
    LEFT JOIN photographers ON photographers.id = projects_rels.photographers_id
    ORDER BY projects_rels.id
  `)) as ProjectRelationRow[]

const createProjectsRelations = async (db: MigrationDB) => {
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`projects_rels\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`order\` integer,
    \`parent_id\` integer NOT NULL,
    \`path\` text NOT NULL,
    \`photographers_id\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`projects\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`photographers_id\`) REFERENCES \`photographers\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`projects_rels_order_idx\` ON \`projects_rels\` (\`order\`)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`projects_rels_parent_idx\` ON \`projects_rels\` (\`parent_id\`)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`projects_rels_path_idx\` ON \`projects_rels\` (\`path\`)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`projects_rels_photographers_id_idx\` ON \`projects_rels\` (\`photographers_id\`)`)
}

const createMediaRelations = async (db: MigrationDB) => {
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`media_rels\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`order\` integer,
    \`parent_id\` integer NOT NULL,
    \`path\` text NOT NULL,
    \`photographers_id\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`photographers_id\`) REFERENCES \`photographers\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`media_rels_order_idx\` ON \`media_rels\` (\`order\`)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`media_rels_parent_idx\` ON \`media_rels\` (\`parent_id\`)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`media_rels_path_idx\` ON \`media_rels\` (\`path\`)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`media_rels_photographers_id_idx\` ON \`media_rels\` (\`photographers_id\`)`)
}

const assignmentKey = (assignments: readonly PhotoshootAttribution[]) =>
  assignments
    .map(
      (assignment) =>
        `${assignment.photoshootId}:${sorted(assignment.photographerIds).join(',')}`,
    )
    .sort()
    .join('|')

export function assertCompatibleExistingAssignments(
  mediaAssignments: readonly PhotoshootAttribution[],
  existingPhotoshootAssignments: readonly PhotoshootAttribution[],
) {
  if (
    existingPhotoshootAssignments.length > 0 &&
    assignmentKey(existingPhotoshootAssignments) !== assignmentKey(mediaAssignments)
  ) {
    throw new Error(
      `Photographer migration preflight failed: existing photoshoot assignments conflict with media assignments (photoshoots=[${assignmentKey(existingPhotoshootAssignments)}]; media=[${assignmentKey(mediaAssignments)}])`,
    )
  }
}

const mediaAssignmentKey = (assignments: readonly MediaAttribution[]) =>
  assignments
    .map(
      (assignment) => `${assignment.mediaId}:${sorted(assignment.photographerIds).join(',')}`,
    )
    .sort()
    .join('|')

export function assertCompatibleExistingMediaAssignments(
  desiredAssignments: readonly MediaAttribution[],
  existingAssignments: readonly MediaAttribution[],
) {
  if (
    existingAssignments.length > 0 &&
    mediaAssignmentKey(existingAssignments) !== mediaAssignmentKey(desiredAssignments)
  ) {
    throw new Error(
      `Photographer migration rollback preflight failed: existing media assignments conflict with photoshoot assignments (media=[${mediaAssignmentKey(existingAssignments)}]; photoshoots=[${mediaAssignmentKey(desiredAssignments)}])`,
    )
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const hasMediaRelations = await tableExists(db, 'media_rels')
  const hasProjectRelations = await tableExists(db, 'projects_rels')

  if (!hasMediaRelations) {
    if (hasProjectRelations) {
      await assertColumns(db, 'projects_rels', [
        'id',
        'order',
        'parent_id',
        'path',
        'photographers_id',
      ])
      return
    }
    throw new Error('Cannot migrate photographer attribution: neither media_rels nor projects_rels exists')
  }

  await assertColumns(db, 'media_rels', [
    'id',
    'order',
    'parent_id',
    'path',
    'photographers_id',
  ])
  if (hasProjectRelations) {
    await assertColumns(db, 'projects_rels', [
      'id',
      'order',
      'parent_id',
      'path',
      'photographers_id',
    ])
  }

  // Every destructive-data check happens before the first schema or data write.
  const assignments = preflightPhotographerTransfer(await readMediaRelations(db))
  if (hasProjectRelations) {
    const existing = preflightPhotoshootAttributions(await readProjectRelations(db))
    assertCompatibleExistingAssignments(assignments, existing)
  }

  await createProjectsRelations(db)
  await db.run(sql`DELETE FROM \`projects_rels\` WHERE \`path\` = 'photographers'`)
  for (const assignment of assignments) {
    for (const [index, photographerId] of assignment.photographerIds.entries()) {
      await db.run(sql`
        INSERT INTO \`projects_rels\` (\`order\`, \`parent_id\`, \`path\`, \`photographers_id\`)
        VALUES (${index + 1}, ${assignment.photoshootId}, 'photographers', ${photographerId})
      `)
    }
  }

  const copied = preflightPhotoshootAttributions(await readProjectRelations(db))
  if (assignmentKey(copied) !== assignmentKey(assignments)) {
    throw new Error('Photographer migration copy verification failed; media_rels was not dropped')
  }

  await db.run(sql`DROP TABLE \`media_rels\``)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const hasMediaRelations = await tableExists(db, 'media_rels')
  const hasProjectRelations = await tableExists(db, 'projects_rels')

  if (!hasProjectRelations) {
    if (hasMediaRelations) {
      await assertColumns(db, 'media_rels', [
        'id',
        'order',
        'parent_id',
        'path',
        'photographers_id',
      ])
      return
    }
    throw new Error('Cannot roll back photographer attribution: neither projects_rels nor media_rels exists')
  }

  await assertColumns(db, 'projects_rels', [
    'id',
    'order',
    'parent_id',
    'path',
    'photographers_id',
  ])
  if (hasMediaRelations) {
    await assertColumns(db, 'media_rels', [
      'id',
      'order',
      'parent_id',
      'path',
      'photographers_id',
    ])
  }

  const assignments = preflightPhotoshootAttributions(await readProjectRelations(db))
  const media = (await db.all(sql`
    SELECT id AS media_id, photoshoot_id
    FROM media
    ORDER BY id
  `)) as MediaRow[]
  assertRollbackRepresentable(assignments, media)
  const fanout = fanOutPhotoshootAttributions(assignments, media)
  if (hasMediaRelations) {
    const existing = mediaAttributionsFromRows(await readMediaRelations(db))
    assertCompatibleExistingMediaAssignments(fanout, existing)
  }

  await createMediaRelations(db)
  await db.run(sql`DELETE FROM \`media_rels\` WHERE \`path\` = 'photographers'`)
  for (const assignment of fanout) {
    for (const [index, photographerId] of assignment.photographerIds.entries()) {
      await db.run(sql`
        INSERT INTO \`media_rels\` (\`order\`, \`parent_id\`, \`path\`, \`photographers_id\`)
        VALUES (${index + 1}, ${assignment.mediaId}, 'photographers', ${photographerId})
      `)
    }
  }

  const copied = preflightPhotographerTransfer(await readMediaRelations(db))
  const copiedFanout = fanOutPhotoshootAttributions(copied, media)
  if (mediaAssignmentKey(copiedFanout) !== mediaAssignmentKey(fanout)) {
    throw new Error('Photographer migration rollback verification failed; projects_rels was not dropped')
  }

  await db.run(sql`DROP TABLE \`projects_rels\``)
}
