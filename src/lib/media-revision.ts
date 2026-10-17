// Browser-safe identity grammar; filesystem containment remains a server concern.
export const mediaRevision = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null

export function publishedDerivative(value: string, mediaId: string | number | undefined) {
  const match = /^generated\/([1-9]\d*)\/r([1-9]\d*)\/(playback\.mp4|poster\.jpg)$/.exec(value)
  if (!match || String(mediaId) !== match[1] || !mediaRevision(Number(match[1]))) return null
  const revision = mediaRevision(Number(match[2]))
  return revision ? { revision, kind: match[3] === 'playback.mp4' ? 'playback' as const : 'poster' as const } : null
}

export function versionMediaURL(url: string | null, revision: unknown) {
  const valid = mediaRevision(revision)
  if (!url || !valid) return url
  const hashIndex = url.indexOf('#')
  const hash = hashIndex < 0 ? '' : url.slice(hashIndex)
  const base = hashIndex < 0 ? url : url.slice(0, hashIndex)
  const queryIndex = base.indexOf('?')
  const pathname = queryIndex < 0 ? base : base.slice(0, queryIndex)
  const query = new URLSearchParams(queryIndex < 0 ? '' : base.slice(queryIndex + 1))
  query.set('v', String(valid))
  return `${pathname}?${query}${hash}`
}
