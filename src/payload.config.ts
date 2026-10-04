import { sqliteAdapter } from '@payloadcms/db-sqlite'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Media } from './collections/Media'
import { Projects } from './collections/Projects'
import { Users } from './collections/Users'
import { SiteSettings } from './globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: ' — Carla Gorecka' },
  },
  collections: [Users, Media, Projects],
  globals: [SiteSettings],
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URL || 'file:./data/karolg.db',
    },
  }),
  secret: process.env.PAYLOAD_SECRET || 'development-only-change-me',
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
