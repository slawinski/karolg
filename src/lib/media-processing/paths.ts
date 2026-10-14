import path from 'node:path'

export const MEDIA_STATIC_DIR = path.resolve(
  /* turbopackIgnore: true */
  process.env.MEDIA_STATIC_DIR || path.join(process.cwd(), 'media'),
)
export const GENERATED_MEDIA_ROOT = path.join(MEDIA_STATIC_DIR, 'generated')

export type DerivativeKind = 'playback' | 'poster'

export function normalizeRelativeMediaPath(value: string) {
  if (
    !value ||
    value.includes('\\') ||
    path.posix.isAbsolute(value) ||
    path.win32.isAbsolute(value)
  ) {
    throw new Error('Invalid relative media path')
  }

  const segments = value.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('Invalid relative media path')
  }

  const normalized = path.posix.normalize(value)
  if (normalized !== value || normalized.startsWith('../')) {
    throw new Error('Invalid relative media path')
  }
  return normalized
}

export function derivativeRelativePath(
  mediaId: number,
  revision: number,
  kind: DerivativeKind,
) {
  if (!Number.isSafeInteger(mediaId) || mediaId < 1) {
    throw new Error('Invalid media ID')
  }
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error('Invalid processing revision')
  }

  const filename = kind === 'playback' ? 'playback.mp4' : 'poster.jpg'
  return `generated/${mediaId}/r${revision}/${filename}`
}

export function validateOwnedDerivativePath(
  value: string,
  mediaId: number,
  expectedKind?: DerivativeKind,
) {
  const normalized = normalizeRelativeMediaPath(value)
  const match = normalized.match(
    /^generated\/([1-9]\d*)\/r([1-9]\d*)\/(playback\.mp4|poster\.jpg)$/,
  )
  if (!match || Number(match[1]) !== mediaId) {
    throw new Error('Derivative is not owned by this media record')
  }

  const kind = match[3] === 'playback.mp4' ? 'playback' : 'poster'
  if (expectedKind && kind !== expectedKind) {
    throw new Error('Derivative kind does not match')
  }

  return { relativePath: normalized, revision: Number(match[2]), kind }
}

export function resolveContainedMediaPath(
  relativePath: string,
  mediaRoot = MEDIA_STATIC_DIR,
) {
  const normalized = normalizeRelativeMediaPath(relativePath)
  const root = path.resolve(/* turbopackIgnore: true */ mediaRoot)
  const resolved = path.resolve(root, ...normalized.split('/'))
  const relative = path.relative(root, resolved)

  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Media path escapes configured root')
  }
  return resolved
}

export function resolveOwnedDerivativePath(
  relativePath: string,
  mediaId: number,
  kind?: DerivativeKind,
  mediaRoot = MEDIA_STATIC_DIR,
) {
  const owned = validateOwnedDerivativePath(relativePath, mediaId, kind)
  return {
    ...owned,
    absolutePath: resolveContainedMediaPath(owned.relativePath, mediaRoot),
  }
}
