import { sqliteAdapter } from '@payloadcms/db-sqlite'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Media } from './collections/Media'
import { Photographers } from './collections/Photographers'
import { Photoshoots } from './collections/Photoshoots'
import { Users } from './collections/Users'
import { SiteSettings } from './globals/SiteSettings'
import { boundedEnvironmentInteger, requirePayloadSecret } from './lib/environment'
import { MEDIA_PROCESSING_QUEUE } from './lib/media-processing/service'
import { processVideoTask } from './lib/media-processing/task'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const projectRoot = path.resolve(dirname, '..')

const payloadSecret = requirePayloadSecret(process.env.PAYLOAD_SECRET)

const uploadFileSize = boundedEnvironmentInteger(
  'UPLOAD_MAX_FILE_BYTES',
  process.env.UPLOAD_MAX_FILE_BYTES,
  512 * 1024 * 1024,
  1024 * 1024,
  2 * 1024 * 1024 * 1024,
)
const uploadRequestSize = boundedEnvironmentInteger(
  'UPLOAD_MAX_REQUEST_BYTES',
  process.env.UPLOAD_MAX_REQUEST_BYTES,
  uploadFileSize + 1024 * 1024,
  uploadFileSize,
  2 * 1024 * 1024 * 1024 + 16 * 1024 * 1024,
)
const uploadTimeout = boundedEnvironmentInteger(
  'UPLOAD_TIMEOUT_MS',
  process.env.UPLOAD_TIMEOUT_MS,
  10 * 60_000,
  10_000,
  60 * 60_000,
)

const rawDbUrl = process.env.DATABASE_URL || 'file:./data/karolg.db'
// Resolve relative sqlite paths against the project root so the DB connects
// regardless of the process working directory.
const dbUrl = rawDbUrl.startsWith('file:./')
  ? `file:${path.resolve(projectRoot, rawDbUrl.slice('file:./'.length))}`
  : rawDbUrl

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: ' — Carla Gorecka' },
  },
  collections: [Users, Photographers, Media, Photoshoots],
  globals: [SiteSettings],
  db: sqliteAdapter({
    push: false,
    client: {
      url: dbUrl,
    },
  }),
  secret: payloadSecret,
  sharp,
  upload: {
    requestSizeLimit: uploadRequestSize,
    limits: { fileSize: uploadFileSize },
    abortOnLimit: true,
    uploadTimeout,
    safeFileNames: true,
    preserveExtension: true,
    useTempFiles: true,
    tempFileDir: path.resolve(projectRoot, 'data/upload-tmp'),
  },
  jobs: {
    enableConcurrencyControl: true,
    tasks: [processVideoTask],
    autoRun: process.env.DISABLE_MEDIA_JOB_AUTORUN === '1'
      ? []
      : [
          {
            cron: '* * * * * *',
            queue: MEDIA_PROCESSING_QUEUE,
            limit: 1,
          },
        ],
    deleteJobOnComplete: true,
  },
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
