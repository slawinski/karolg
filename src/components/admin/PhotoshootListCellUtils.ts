import type { SanitizedPermissions } from 'payload'

export const getRelationshipID = (value: unknown): string => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>

    if (typeof record.id === 'string' || typeof record.id === 'number') {
      return String(record.id)
    }

    if (typeof record.value === 'string' || typeof record.value === 'number') {
      return String(record.value)
    }
  }

  return ''
}

export const getRelationshipIDs = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : value == null ? [] : [value]
  return values.map(getRelationshipID).filter(Boolean)
}

export const canUpdatePhotoshoots = (permissions?: SanitizedPermissions) =>
  Boolean(permissions?.collections?.projects?.update)
