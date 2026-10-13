import path from 'node:path'
import { loadEnvFile } from 'node:process'
import { getPayload, type Where } from 'payload'
import { requestMediaReprocess } from '../src/lib/media-processing/service'

const root = process.cwd()
for (const envFile of ['.env', '.env.local']) {
  try {
    loadEnvFile(path.join(root, envFile))
  } catch {
    // Optional local env file.
  }
}

const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [name, value = 'true'] = argument.split('=', 2)
    return [name, value]
  }),
)
const apply = args.has('--apply')
const kind = args.get('--kind') || 'all'
const afterId = Number(args.get('--after-id') || 0)
const limit = Math.min(Math.max(Number(args.get('--limit') || 100), 1), 500)
const missingColor = args.has('--missing-color')
const failedOnly = args.has('--failed-only')

if (!['all', 'image', 'video'].includes(kind)) {
  throw new Error('--kind must be image, video, or all')
}
if (!Number.isInteger(afterId) || afterId < 0) {
  throw new Error('--after-id must be a non-negative integer')
}

const and: Where[] = []
if (afterId) and.push({ id: { greater_than: afterId } })
if (kind !== 'all') and.push({ kind: { equals: kind } })
if (missingColor) and.push({ transitionColor: { exists: false } })
if (failedOnly) and.push({ processingStatus: { equals: 'failed' } })

const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })

try {
  const result = await payload.find({
    collection: 'media',
    depth: 0,
    limit,
    sort: 'id',
    overrideAccess: true,
    ...(and.length ? { where: { and } } : {}),
  })

  payload.logger.info(
    `${apply ? 'Reprocessing' : 'Dry run'}: ${result.docs.length} media record(s) after ID ${afterId}`,
  )

  for (const media of result.docs) {
    if (apply) {
      const status = await requestMediaReprocess(payload, media.id)
      payload.logger.info(`Media ${media.id}: ${status.kind}/${status.status}`)
    } else {
      payload.logger.info(`Would reprocess media ${media.id} (${media.kind})`)
    }
  }

  const lastId = result.docs.at(-1)?.id
  if (lastId) {
    payload.logger.info(`Resume with --after-id=${lastId}`)
  }
  if (!apply) {
    payload.logger.info('No records changed. Add --apply to execute.')
  }
} finally {
  await payload.destroy()
}
