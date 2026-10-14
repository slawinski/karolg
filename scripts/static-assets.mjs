import { access, copyFile, mkdir, rm } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'

const safeFilename = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null
  if (
    value.includes('\\') ||
    path.posix.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    value.split('/').some((segment) => !segment || segment === '.' || segment === '..') ||
    path.posix.normalize(value) !== value
  ) {
    throw new Error(`Unsafe media filename in static snapshot: ${value}`)
  }
  return value
}

export function createAssetManifest(media) {
  const filenames = new Set()

  for (const item of media) {
    const kind = item.kind === 'video' || item.mimeType?.startsWith('video/')
      ? 'video'
      : 'image'
    const status = item.processingStatus || (kind === 'image' ? 'ready' : 'pending')
    const original = safeFilename(item.filename)
    const playback = safeFilename(item.playbackFilename)
    const poster = safeFilename(item.posterFilename)

    if (kind === 'image' && status === 'ready' && !original) {
      throw new Error(`Ready ${kind} media ${item.id ?? '(unknown ID)'} has no original filename`)
    }
    if (kind === 'video' && status === 'ready' && (!playback || !poster)) {
      throw new Error(
        `Ready video media ${item.id ?? '(unknown ID)'} requires playback and poster filenames`,
      )
    }

    if (kind === 'image' && original) filenames.add(original)
    if (playback) filenames.add(playback)
    if (poster) filenames.add(poster)
  }

  return [...filenames].sort()
}

export async function copyStaticAssets({ manifest, sourceDir, outDir }) {
  const destination = path.join(outDir, 'media')
  await rm(destination, { recursive: true, force: true })
  await mkdir(destination, { recursive: true })

  for (const filename of manifest) {
    const segments = filename.split('/')
    const source = path.resolve(sourceDir, ...segments)
    const target = path.resolve(destination, ...segments)
    if (
      path.relative(path.resolve(sourceDir), source).startsWith('..') ||
      path.relative(destination, target).startsWith('..')
    ) {
      throw new Error(`Unsafe media filename in static manifest: ${filename}`)
    }
    try {
      await access(source, constants.R_OK)
    } catch {
      throw new Error(`Static export is missing referenced media asset: ${source}`)
    }
    await mkdir(path.dirname(target), { recursive: true })
    await copyFile(source, target)
  }
}
