import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-sqlite'
import { sql } from '@payloadcms/db-sqlite'

const tableExists = async (db: MigrateUpArgs['db'], table: string) => {
  const rows = await db.all(sql`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name = ${table}
    LIMIT 1
  `)
  return rows.length > 0
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (await tableExists(db, 'media')) return
  if ((await tableExists(db, 'users')) || (await tableExists(db, 'projects'))) {
    throw new Error('Cannot bootstrap schema: found a partial legacy database without the media table')
  }

  await db.run(sql`CREATE TABLE \`users_sessions\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`created_at\` text,
    \`expires_at\` text NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`)
  await db.run(sql`CREATE INDEX \`users_sessions_order_idx\` ON \`users_sessions\` (\`_order\`)`)
  await db.run(sql`CREATE INDEX \`users_sessions_parent_id_idx\` ON \`users_sessions\` (\`_parent_id\`)`)
  await db.run(sql`CREATE TABLE \`users\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`name\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`email\` text NOT NULL,
    \`reset_password_token\` text,
    \`reset_password_expiration\` text,
    \`salt\` text,
    \`hash\` text,
    \`reset_password_requested_at\` text,
    \`login_attempts\` numeric DEFAULT 0,
    \`lock_until\` text
  )`)
  await db.run(sql`CREATE INDEX \`users_updated_at_idx\` ON \`users\` (\`updated_at\`)`)
  await db.run(sql`CREATE INDEX \`users_created_at_idx\` ON \`users\` (\`created_at\`)`)
  await db.run(sql`CREATE UNIQUE INDEX \`users_email_idx\` ON \`users\` (\`email\`)`)
  await db.run(sql`CREATE TABLE \`photographers\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`display_name\` text NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  )`)
  await db.run(sql`CREATE INDEX \`photographers_updated_at_idx\` ON \`photographers\` (\`updated_at\`)`)
  await db.run(sql`CREATE INDEX \`photographers_created_at_idx\` ON \`photographers\` (\`created_at\`)`)
  await db.run(sql`CREATE TABLE \`media\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`alt\` text NOT NULL,
    \`caption\` text,
    \`photoshoot_id\` integer,
    \`transition_color\` text,
    \`kind\` text DEFAULT 'image' NOT NULL,
    \`processing_status\` text DEFAULT 'ready' NOT NULL,
    \`processing_revision\` numeric DEFAULT 0 NOT NULL,
    \`processing_error\` text,
    \`duration\` numeric,
    \`video_width\` numeric,
    \`video_height\` numeric,
    \`playback_filename\` text,
    \`playback_url\` text,
    \`playback_mime_type\` text,
    \`playback_filesize\` numeric,
    \`poster_filename\` text,
    \`poster_url\` text,
    \`poster_mime_type\` text,
    \`poster_width\` numeric,
    \`poster_height\` numeric,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`url\` text,
    \`thumbnail_u_r_l\` text,
    \`filename\` text,
    \`mime_type\` text,
    \`filesize\` numeric,
    \`width\` numeric,
    \`height\` numeric,
    \`focal_x\` numeric,
    \`focal_y\` numeric,
    \`sizes_card_url\` text,
    \`sizes_card_width\` numeric,
    \`sizes_card_height\` numeric,
    \`sizes_card_mime_type\` text,
    \`sizes_card_filesize\` numeric,
    \`sizes_card_filename\` text,
    \`sizes_hero_url\` text,
    \`sizes_hero_width\` numeric,
    \`sizes_hero_height\` numeric,
    \`sizes_hero_mime_type\` text,
    \`sizes_hero_filesize\` numeric,
    \`sizes_hero_filename\` text,
    FOREIGN KEY (\`photoshoot_id\`) REFERENCES \`projects\`(\`id\`) ON UPDATE no action ON DELETE set null
  )`)
  await db.run(sql`CREATE INDEX \`media_photoshoot_idx\` ON \`media\` (\`photoshoot_id\`)`)
  await db.run(sql`CREATE INDEX \`media_updated_at_idx\` ON \`media\` (\`updated_at\`)`)
  await db.run(sql`CREATE INDEX \`media_created_at_idx\` ON \`media\` (\`created_at\`)`)
  await db.run(sql`CREATE UNIQUE INDEX \`media_filename_idx\` ON \`media\` (\`filename\`)`)
  await db.run(sql`CREATE INDEX \`media_sizes_card_sizes_card_filename_idx\` ON \`media\` (\`sizes_card_filename\`)`)
  await db.run(sql`CREATE INDEX \`media_sizes_hero_sizes_hero_filename_idx\` ON \`media\` (\`sizes_hero_filename\`)`)
  await db.run(sql`CREATE TABLE \`media_rels\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`order\` integer,
    \`parent_id\` integer NOT NULL,
    \`path\` text NOT NULL,
    \`photographers_id\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`photographers_id\`) REFERENCES \`photographers\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`)
  await db.run(sql`CREATE INDEX \`media_rels_order_idx\` ON \`media_rels\` (\`order\`)`)
  await db.run(sql`CREATE INDEX \`media_rels_parent_idx\` ON \`media_rels\` (\`parent_id\`)`)
  await db.run(sql`CREATE INDEX \`media_rels_path_idx\` ON \`media_rels\` (\`path\`)`)
  await db.run(sql`CREATE INDEX \`media_rels_photographers_id_idx\` ON \`media_rels\` (\`photographers_id\`)`)
  await db.run(sql`CREATE TABLE \`projects\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`title\` text NOT NULL,
    \`slug\` text,
    \`excerpt\` text,
    \`year\` text,
    \`order\` numeric DEFAULT 10,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  )`)
  await db.run(sql`CREATE UNIQUE INDEX \`projects_slug_idx\` ON \`projects\` (\`slug\`)`)
  await db.run(sql`CREATE INDEX \`projects_updated_at_idx\` ON \`projects\` (\`updated_at\`)`)
  await db.run(sql`CREATE INDEX \`projects_created_at_idx\` ON \`projects\` (\`created_at\`)`)
  await db.run(sql`CREATE TABLE \`payload_kv\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`key\` text NOT NULL,
    \`data\` text NOT NULL
  )`)
  await db.run(sql`CREATE UNIQUE INDEX \`payload_kv_key_idx\` ON \`payload_kv\` (\`key\`)`)
  await db.run(sql`CREATE TABLE \`payload_jobs_log\` (
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
  await db.run(sql`CREATE INDEX \`payload_jobs_log_order_idx\` ON \`payload_jobs_log\` (\`_order\`)`)
  await db.run(sql`CREATE INDEX \`payload_jobs_log_parent_id_idx\` ON \`payload_jobs_log\` (\`_parent_id\`)`)
  await db.run(sql`CREATE TABLE \`payload_jobs\` (
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
  await db.run(sql`CREATE INDEX \`payload_jobs_completed_at_idx\` ON \`payload_jobs\` (\`completed_at\`)`)
  await db.run(sql`CREATE INDEX \`payload_jobs_total_tried_idx\` ON \`payload_jobs\` (\`total_tried\`)`)
  await db.run(sql`CREATE INDEX \`payload_jobs_has_error_idx\` ON \`payload_jobs\` (\`has_error\`)`)
  await db.run(sql`CREATE INDEX \`payload_jobs_task_slug_idx\` ON \`payload_jobs\` (\`task_slug\`)`)
  await db.run(sql`CREATE INDEX \`payload_jobs_queue_idx\` ON \`payload_jobs\` (\`queue\`)`)
  await db.run(sql`CREATE INDEX \`payload_jobs_wait_until_idx\` ON \`payload_jobs\` (\`wait_until\`)`)
  await db.run(sql`CREATE INDEX \`payload_jobs_processing_idx\` ON \`payload_jobs\` (\`processing\`)`)
  await db.run(sql`CREATE INDEX \`payload_jobs_concurrency_key_idx\` ON \`payload_jobs\` (\`concurrency_key\`)`)
  await db.run(sql`CREATE INDEX \`payload_jobs_updated_at_idx\` ON \`payload_jobs\` (\`updated_at\`)`)
  await db.run(sql`CREATE INDEX \`payload_jobs_created_at_idx\` ON \`payload_jobs\` (\`created_at\`)`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`global_slug\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  )`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_global_slug_idx\` ON \`payload_locked_documents\` (\`global_slug\`)`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_updated_at_idx\` ON \`payload_locked_documents\` (\`updated_at\`)`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_created_at_idx\` ON \`payload_locked_documents\` (\`created_at\`)`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents_rels\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`order\` integer,
    \`parent_id\` integer NOT NULL,
    \`path\` text NOT NULL,
    \`users_id\` integer,
    \`photographers_id\` integer,
    \`media_id\` integer,
    \`projects_id\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`photographers_id\`) REFERENCES \`photographers\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`projects_id\`) REFERENCES \`projects\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`)`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`)`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`)`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`)`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_photographers_id_idx\` ON \`payload_locked_documents_rels\` (\`photographers_id\`)`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`)`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_projects_id_idx\` ON \`payload_locked_documents_rels\` (\`projects_id\`)`)
  await db.run(sql`CREATE TABLE \`payload_preferences\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`key\` text,
    \`value\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  )`)
  await db.run(sql`CREATE INDEX \`payload_preferences_key_idx\` ON \`payload_preferences\` (\`key\`)`)
  await db.run(sql`CREATE INDEX \`payload_preferences_updated_at_idx\` ON \`payload_preferences\` (\`updated_at\`)`)
  await db.run(sql`CREATE INDEX \`payload_preferences_created_at_idx\` ON \`payload_preferences\` (\`created_at\`)`)
  await db.run(sql`CREATE TABLE \`payload_preferences_rels\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`order\` integer,
    \`parent_id\` integer NOT NULL,
    \`path\` text NOT NULL,
    \`users_id\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`)`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`)`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`)`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_users_id_idx\` ON \`payload_preferences_rels\` (\`users_id\`)`)
  await db.run(sql`CREATE TABLE \`payload_migrations\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`name\` text,
    \`batch\` numeric,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  )`)
  await db.run(sql`CREATE INDEX \`payload_migrations_updated_at_idx\` ON \`payload_migrations\` (\`updated_at\`)`)
  await db.run(sql`CREATE INDEX \`payload_migrations_created_at_idx\` ON \`payload_migrations\` (\`created_at\`)`)
  await db.run(sql`CREATE TABLE \`site_settings_locations\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`label\` text NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`site_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`)
  await db.run(sql`CREATE INDEX \`site_settings_locations_order_idx\` ON \`site_settings_locations\` (\`_order\`)`)
  await db.run(sql`CREATE INDEX \`site_settings_locations_parent_id_idx\` ON \`site_settings_locations\` (\`_parent_id\`)`)
  await db.run(sql`CREATE TABLE \`site_settings_profile_facts\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`label\` text NOT NULL,
    \`value\` text NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`site_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`)
  await db.run(sql`CREATE INDEX \`site_settings_profile_facts_order_idx\` ON \`site_settings_profile_facts\` (\`_order\`)`)
  await db.run(sql`CREATE INDEX \`site_settings_profile_facts_parent_id_idx\` ON \`site_settings_profile_facts\` (\`_parent_id\`)`)
  await db.run(sql`CREATE TABLE \`site_settings\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`name\` text DEFAULT 'CARLA GORECKA' NOT NULL,
    \`roles\` text DEFAULT 'MODEL / PILATES / CREATIVE' NOT NULL,
    \`hero_eyebrow\` text DEFAULT 'HONEST
NATURAL
AUTHENTIC
IN MOTION',
    \`hero_headline\` text DEFAULT 'A CREATIVE APPROACH TO MODELING' NOT NULL,
    \`handwritten_line\` text DEFAULT 'Movement · People · Stories',
    \`intro\` text DEFAULT 'A portfolio built around fashion, movement and natural portraiture.',
    \`hero_media_id\` integer,
    \`instagram\` text DEFAULT 'https://www.instagram.com/carlagorecka/',
    \`email\` text,
    \`seo_description\` text DEFAULT 'Portfolio of Carla Gorecka — model, classical Pilates teacher and creative.',
    \`updated_at\` text,
    \`created_at\` text,
    FOREIGN KEY (\`hero_media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  )`)
  await db.run(sql`CREATE INDEX \`site_settings_hero_media_idx\` ON \`site_settings\` (\`hero_media_id\`)`)
  await db.run(sql`CREATE TABLE \`_portfolio_schema_bootstrap\` (\`id\` integer PRIMARY KEY NOT NULL)`)
  await db.run(sql`INSERT INTO \`_portfolio_schema_bootstrap\` (\`id\`) VALUES (1)`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (!(await tableExists(db, '_portfolio_schema_bootstrap'))) return

  await db.run(sql`DROP TABLE IF EXISTS \`site_settings_locations\``)
  await db.run(sql`DROP TABLE IF EXISTS \`site_settings_profile_facts\``)
  await db.run(sql`DROP TABLE IF EXISTS \`site_settings\``)
  await db.run(sql`DROP TABLE IF EXISTS \`payload_preferences_rels\``)
  await db.run(sql`DROP TABLE IF EXISTS \`payload_preferences\``)
  await db.run(sql`DROP TABLE IF EXISTS \`payload_locked_documents_rels\``)
  await db.run(sql`DROP TABLE IF EXISTS \`payload_locked_documents\``)
  await db.run(sql`DROP TABLE IF EXISTS \`payload_jobs_log\``)
  await db.run(sql`DROP TABLE IF EXISTS \`payload_jobs\``)
  await db.run(sql`DROP TABLE IF EXISTS \`media_rels\``)
  await db.run(sql`DROP TABLE IF EXISTS \`users_sessions\``)
  await db.run(sql`DROP TABLE IF EXISTS \`media\``)
  await db.run(sql`DROP TABLE IF EXISTS \`photographers\``)
  await db.run(sql`DROP TABLE IF EXISTS \`projects\``)
  await db.run(sql`DROP TABLE IF EXISTS \`users\``)
  await db.run(sql`DROP TABLE IF EXISTS \`payload_kv\``)
  await db.run(sql`DROP TABLE IF EXISTS \`_portfolio_schema_bootstrap\``)
  await db.run(sql`DROP TABLE IF EXISTS \`payload_migrations\``)
}
