export const FALLBACK_INSTAGRAM_URL = 'https://www.instagram.com/carlagorecka/'

export function normalizeInstagramUrl(value: string | null | undefined) {
  const configuredUrl = value?.trim()
  if (!configuredUrl) return FALLBACK_INSTAGRAM_URL

  try {
    const url = new URL(configuredUrl)
    const isInstagram = /^(www\.)?instagram\.com$/i.test(url.hostname)
    return isInstagram && url.protocol === 'https:' ? url.href : FALLBACK_INSTAGRAM_URL
  } catch {
    return FALLBACK_INSTAGRAM_URL
  }
}

export function instagramLabel(url: string) {
  const username = new URL(url).pathname.split('/').filter(Boolean)[0]
  return username ? `@${username}` : 'Instagram'
}
