import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-sqlite'
import { sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`social_image_id\` integer REFERENCES media(id) ON DELETE SET NULL;`)
  await db.run(sql`CREATE INDEX \`site_settings_social_image_idx\` ON \`site_settings\` (\`social_image_id\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX \`site_settings_social_image_idx\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`social_image_id\`;`)
}
