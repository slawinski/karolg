import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-sqlite'
import { sql } from '@payloadcms/db-sqlite'

type MigrationDB = MigrateUpArgs['db']
type MigrationQuery = Parameters<MigrationDB['run']>[0]

const tableExists = async (db: MigrationDB, table: string) => {
  const rows = await db.all(sql`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name = ${table}
    LIMIT 1
  `)
  return rows.length > 0
}

const columnExists = async (db: MigrationDB, table: string, column: string) => {
  const rows = await db.all(sql`
    SELECT name FROM pragma_table_info(${table})
    WHERE name = ${column}
    LIMIT 1
  `)
  return rows.length > 0
}

const addColumnIfMissing = async (
  db: MigrationDB,
  table: string,
  column: string,
  statement: MigrationQuery,
) => {
  if (!(await columnExists(db, table, column))) await db.run(statement)
}

const dropColumnIfPresent = async (
  db: MigrationDB,
  table: string,
  column: string,
  statement: MigrationQuery,
) => {
  if (await columnExists(db, table, column)) await db.run(statement)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (await tableExists(db, '_portfolio_schema_bootstrap')) return

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`photographers\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`display_name\` text NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  )`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`photographers_updated_at_idx\` ON \`photographers\` (\`updated_at\`)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`photographers_created_at_idx\` ON \`photographers\` (\`created_at\`)`)

  const mediaColumns: Array<[string, MigrationQuery]> = [
    ['transition_color', sql`ALTER TABLE \`media\` ADD \`transition_color\` text`],
    ['kind', sql`ALTER TABLE \`media\` ADD \`kind\` text DEFAULT 'image' NOT NULL`],
    ['processing_status', sql`ALTER TABLE \`media\` ADD \`processing_status\` text DEFAULT 'ready' NOT NULL`],
    ['processing_revision', sql`ALTER TABLE \`media\` ADD \`processing_revision\` numeric DEFAULT 0 NOT NULL`],
    ['processing_error', sql`ALTER TABLE \`media\` ADD \`processing_error\` text`],
    ['duration', sql`ALTER TABLE \`media\` ADD \`duration\` numeric`],
    ['video_width', sql`ALTER TABLE \`media\` ADD \`video_width\` numeric`],
    ['video_height', sql`ALTER TABLE \`media\` ADD \`video_height\` numeric`],
    ['playback_filename', sql`ALTER TABLE \`media\` ADD \`playback_filename\` text`],
    ['playback_url', sql`ALTER TABLE \`media\` ADD \`playback_url\` text`],
    ['playback_mime_type', sql`ALTER TABLE \`media\` ADD \`playback_mime_type\` text`],
    ['playback_filesize', sql`ALTER TABLE \`media\` ADD \`playback_filesize\` numeric`],
    ['poster_filename', sql`ALTER TABLE \`media\` ADD \`poster_filename\` text`],
    ['poster_url', sql`ALTER TABLE \`media\` ADD \`poster_url\` text`],
    ['poster_mime_type', sql`ALTER TABLE \`media\` ADD \`poster_mime_type\` text`],
    ['poster_width', sql`ALTER TABLE \`media\` ADD \`poster_width\` numeric`],
    ['poster_height', sql`ALTER TABLE \`media\` ADD \`poster_height\` numeric`],
  ]
  for (const [column, statement] of mediaColumns) {
    await addColumnIfMissing(db, 'media', column, statement)
  }

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`media_rels\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`order\` integer,
    \`parent_id\` integer NOT NULL,
    \`path\` text NOT NULL,
    \`photographers_id\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`photographers_id\`) REFERENCES \`photographers\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`)
  await addColumnIfMissing(
    db,
    'media_rels',
    'photographers_id',
    sql`ALTER TABLE \`media_rels\` ADD \`photographers_id\` integer REFERENCES \`photographers\`(\`id\`) ON UPDATE no action ON DELETE cascade`,
  )
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`media_rels_order_idx\` ON \`media_rels\` (\`order\`)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`media_rels_parent_idx\` ON \`media_rels\` (\`parent_id\`)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`media_rels_path_idx\` ON \`media_rels\` (\`path\`)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`media_rels_photographers_id_idx\` ON \`media_rels\` (\`photographers_id\`)`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`payload_jobs\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`input\` text,
    \`completed_at\` text,
    \`total_tried\` numeric DEFAULT 0,
    \`has_error\` integer DEFAULT false,
    \`error\` text,
    \`task_slug\` text,
    \`queue\` text DEFAULT 'default',
    \`wait_until\` text,
    \`processing\` integer DEFAULT false,
    \`concurrency_key\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  )`)
  await addColumnIfMissing(
    db,
    'payload_jobs',
    'concurrency_key',
    sql`ALTER TABLE \`payload_jobs\` ADD \`concurrency_key\` text`,
  )
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_completed_at_idx\` ON \`payload_jobs\` (\`completed_at\`)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_total_tried_idx\` ON \`payload_jobs\` (\`total_tried\`)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_has_error_idx\` ON \`payload_jobs\` (\`has_error\`)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_task_slug_idx\` ON \`payload_jobs\` (\`task_slug\`)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_queue_idx\` ON \`payload_jobs\` (\`queue\`)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_wait_until_idx\` ON \`payload_jobs\` (\`wait_until\`)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_processing_idx\` ON \`payload_jobs\` (\`processing\`)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_concurrency_key_idx\` ON \`payload_jobs\` (\`concurrency_key\`)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_updated_at_idx\` ON \`payload_jobs\` (\`updated_at\`)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_created_at_idx\` ON \`payload_jobs\` (\`created_at\`)`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`payload_jobs_log\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`executed_at\` text NOT NULL,
    \`completed_at\` text NOT NULL,
    \`task_slug\` text NOT NULL,
    \`task_i_d\` text NOT NULL,
    \`input\` text,
    \`output\` text,
    \`state\` text NOT NULL,
    \`error\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`payload_jobs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_log_order_idx\` ON \`payload_jobs_log\` (\`_order\`)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_jobs_log_parent_id_idx\` ON \`payload_jobs_log\` (\`_parent_id\`)`)

  await addColumnIfMissing(
    db,
    'payload_locked_documents_rels',
    'photographers_id',
    sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`photographers_id\` integer REFERENCES \`photographers\`(\`id\`) ON UPDATE no action ON DELETE cascade`,
  )
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_photographers_id_idx\` ON \`payload_locked_documents_rels\` (\`photographers_id\`)`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, '_portfolio_schema_bootstrap')) return

  await db.run(sql`DROP INDEX IF EXISTS \`payload_locked_documents_rels_photographers_id_idx\``)
  await dropColumnIfPresent(
    db,
    'payload_locked_documents_rels',
    'photographers_id',
    sql`ALTER TABLE \`payload_locked_documents_rels\` DROP COLUMN \`photographers_id\``,
  )
  await db.run(sql`DROP TABLE IF EXISTS \`payload_jobs_log\``)
  await db.run(sql`DROP TABLE IF EXISTS \`payload_jobs\``)
  await db.run(sql`DROP TABLE IF EXISTS \`media_rels\``)

  const mediaColumns: Array<[string, MigrationQuery]> = [
    ['poster_height', sql`ALTER TABLE \`media\` DROP COLUMN \`poster_height\``],
    ['poster_width', sql`ALTER TABLE \`media\` DROP COLUMN \`poster_width\``],
    ['poster_mime_type', sql`ALTER TABLE \`media\` DROP COLUMN \`poster_mime_type\``],
    ['poster_url', sql`ALTER TABLE \`media\` DROP COLUMN \`poster_url\``],
    ['poster_filename', sql`ALTER TABLE \`media\` DROP COLUMN \`poster_filename\``],
    ['playback_filesize', sql`ALTER TABLE \`media\` DROP COLUMN \`playback_filesize\``],
    ['playback_mime_type', sql`ALTER TABLE \`media\` DROP COLUMN \`playback_mime_type\``],
    ['playback_url', sql`ALTER TABLE \`media\` DROP COLUMN \`playback_url\``],
    ['playback_filename', sql`ALTER TABLE \`media\` DROP COLUMN \`playback_filename\``],
    ['video_height', sql`ALTER TABLE \`media\` DROP COLUMN \`video_height\``],
    ['video_width', sql`ALTER TABLE \`media\` DROP COLUMN \`video_width\``],
    ['duration', sql`ALTER TABLE \`media\` DROP COLUMN \`duration\``],
    ['processing_error', sql`ALTER TABLE \`media\` DROP COLUMN \`processing_error\``],
    ['processing_revision', sql`ALTER TABLE \`media\` DROP COLUMN \`processing_revision\``],
    ['processing_status', sql`ALTER TABLE \`media\` DROP COLUMN \`processing_status\``],
    ['kind', sql`ALTER TABLE \`media\` DROP COLUMN \`kind\``],
    ['transition_color', sql`ALTER TABLE \`media\` DROP COLUMN \`transition_color\``],
  ]
  for (const [column, statement] of mediaColumns) {
    await dropColumnIfPresent(db, 'media', column, statement)
  }
  await db.run(sql`DROP TABLE IF EXISTS \`photographers\``)
}
