import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-sqlite'
import { sql } from '@payloadcms/db-sqlite'

type MigrationDB = MigrateUpArgs['db']

async function rebuildMediaTable(db: MigrationDB, rebuild: () => Promise<void>) {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  try {
    await db.run(sql`BEGIN IMMEDIATE;`)
    try {
      await rebuild()
      await db.run(sql`COMMIT;`)
    } catch (error) {
      await db.run(sql`ROLLBACK;`)
      throw error
    }
  } finally {
    await db.run(sql`PRAGMA foreign_keys=ON;`)
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await rebuildMediaTable(db, async () => {
    await db.run(sql`CREATE TABLE \`__new_media\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`alt\` text,
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
  );
  `)
    await db.run(sql`INSERT INTO \`__new_media\`("id", "alt", "caption", "photoshoot_id", "transition_color", "kind", "processing_status", "processing_revision", "processing_error", "duration", "video_width", "video_height", "playback_filename", "playback_url", "playback_mime_type", "playback_filesize", "poster_filename", "poster_url", "poster_mime_type", "poster_width", "poster_height", "updated_at", "created_at", "url", "thumbnail_u_r_l", "filename", "mime_type", "filesize", "width", "height", "focal_x", "focal_y", "sizes_card_url", "sizes_card_width", "sizes_card_height", "sizes_card_mime_type", "sizes_card_filesize", "sizes_card_filename", "sizes_hero_url", "sizes_hero_width", "sizes_hero_height", "sizes_hero_mime_type", "sizes_hero_filesize", "sizes_hero_filename") SELECT "id", "alt", "caption", "photoshoot_id", "transition_color", "kind", "processing_status", "processing_revision", "processing_error", "duration", "video_width", "video_height", "playback_filename", "playback_url", "playback_mime_type", "playback_filesize", "poster_filename", "poster_url", "poster_mime_type", "poster_width", "poster_height", "updated_at", "created_at", "url", "thumbnail_u_r_l", "filename", "mime_type", "filesize", "width", "height", "focal_x", "focal_y", "sizes_card_url", "sizes_card_width", "sizes_card_height", "sizes_card_mime_type", "sizes_card_filesize", "sizes_card_filename", "sizes_hero_url", "sizes_hero_width", "sizes_hero_height", "sizes_hero_mime_type", "sizes_hero_filesize", "sizes_hero_filename" FROM \`media\`;`)
    await db.run(sql`DROP TABLE \`media\`;`)
    await db.run(sql`ALTER TABLE \`__new_media\` RENAME TO \`media\`;`)
    await db.run(sql`CREATE INDEX \`media_photoshoot_idx\` ON \`media\` (\`photoshoot_id\`);`)
    await db.run(sql`CREATE INDEX \`media_updated_at_idx\` ON \`media\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`media_created_at_idx\` ON \`media\` (\`created_at\`);`)
    await db.run(sql`CREATE UNIQUE INDEX \`media_filename_idx\` ON \`media\` (\`filename\`);`)
    await db.run(sql`CREATE INDEX \`media_sizes_card_sizes_card_filename_idx\` ON \`media\` (\`sizes_card_filename\`);`)
    await db.run(sql`CREATE INDEX \`media_sizes_hero_sizes_hero_filename_idx\` ON \`media\` (\`sizes_hero_filename\`);`)
  })
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await rebuildMediaTable(db, async () => {
    const [{ count }] = await db.all(sql`SELECT COUNT(*) AS count FROM \`media\` WHERE \`alt\` IS NULL OR TRIM(\`alt\`) = ''`) as Array<{
      count: number
    }>
    if (count > 0) {
      throw new Error(`Cannot make media alt text required: ${count} media item(s) have no alt text.`)
    }

    await db.run(sql`CREATE TABLE \`__new_media\` (
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
  );
  `)
    await db.run(sql`INSERT INTO \`__new_media\`("id", "alt", "caption", "photoshoot_id", "transition_color", "kind", "processing_status", "processing_revision", "processing_error", "duration", "video_width", "video_height", "playback_filename", "playback_url", "playback_mime_type", "playback_filesize", "poster_filename", "poster_url", "poster_mime_type", "poster_width", "poster_height", "updated_at", "created_at", "url", "thumbnail_u_r_l", "filename", "mime_type", "filesize", "width", "height", "focal_x", "focal_y", "sizes_card_url", "sizes_card_width", "sizes_card_height", "sizes_card_mime_type", "sizes_card_filesize", "sizes_card_filename", "sizes_hero_url", "sizes_hero_width", "sizes_hero_height", "sizes_hero_mime_type", "sizes_hero_filesize", "sizes_hero_filename") SELECT "id", "alt", "caption", "photoshoot_id", "transition_color", "kind", "processing_status", "processing_revision", "processing_error", "duration", "video_width", "video_height", "playback_filename", "playback_url", "playback_mime_type", "playback_filesize", "poster_filename", "poster_url", "poster_mime_type", "poster_width", "poster_height", "updated_at", "created_at", "url", "thumbnail_u_r_l", "filename", "mime_type", "filesize", "width", "height", "focal_x", "focal_y", "sizes_card_url", "sizes_card_width", "sizes_card_height", "sizes_card_mime_type", "sizes_card_filesize", "sizes_card_filename", "sizes_hero_url", "sizes_hero_width", "sizes_hero_height", "sizes_hero_mime_type", "sizes_hero_filesize", "sizes_hero_filename" FROM \`media\`;`)
    await db.run(sql`DROP TABLE \`media\`;`)
    await db.run(sql`ALTER TABLE \`__new_media\` RENAME TO \`media\`;`)
    await db.run(sql`CREATE INDEX \`media_photoshoot_idx\` ON \`media\` (\`photoshoot_id\`);`)
    await db.run(sql`CREATE INDEX \`media_updated_at_idx\` ON \`media\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`media_created_at_idx\` ON \`media\` (\`created_at\`);`)
    await db.run(sql`CREATE UNIQUE INDEX \`media_filename_idx\` ON \`media\` (\`filename\`);`)
    await db.run(sql`CREATE INDEX \`media_sizes_card_sizes_card_filename_idx\` ON \`media\` (\`sizes_card_filename\`);`)
    await db.run(sql`CREATE INDEX \`media_sizes_hero_sizes_hero_filename_idx\` ON \`media\` (\`sizes_hero_filename\`);`)
  })
}
