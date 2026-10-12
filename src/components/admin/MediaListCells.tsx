'use client'

import type { DefaultCellComponentProps } from 'payload'
import { useEffect, useState } from 'react'

type PhotoshootOption = {
  id: string | number
  title: string
}

let photoshootsPromise: Promise<PhotoshootOption[]> | null = null

const getRelationshipID = (value: unknown): string => {
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

const getRowID = (rowData: DefaultCellComponentProps['rowData']) => {
  const id = rowData?.id

  if (typeof id === 'string' || typeof id === 'number') {
    return id
  }

  return null
}

const loadPhotoshoots = async () => {
  if (!photoshootsPromise) {
    photoshootsPromise = fetch('/api/projects?limit=100&sort=order&depth=0', {
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Could not load photoshoots')
        }

        const data = (await response.json()) as {
          docs?: Array<{ id: string | number; title?: string }>
        }

        return (data.docs || []).map((doc) => ({
          id: doc.id,
          title: doc.title || 'Untitled photoshoot',
        }))
      })
      .catch((error) => {
        photoshootsPromise = null
        throw error
      })
  }

  return photoshootsPromise
}

const updateMedia = async (
  id: string | number,
  data: Record<string, unknown>,
) => {
  const response = await fetch(`/api/media/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(
      `Could not update media (${response.status})${details ? `: ${details}` : ''}`,
    )
  }

  return response.json()
}

const stopRowNavigation = (event: React.SyntheticEvent) => {
  event.stopPropagation()
}

export function PhotoshootCell({
  cellData,
  rowData,
}: DefaultCellComponentProps) {
  const [photoshoots, setPhotoshoots] = useState<PhotoshootOption[]>([])
  const [value, setValue] = useState(() => getRelationshipID(cellData))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    setValue(getRelationshipID(cellData))
  }, [cellData])

  useEffect(() => {
    let active = true

    void loadPhotoshoots()
      .then((options) => {
        if (active) setPhotoshoots(options)
      })
      .catch(() => {
        if (active) setError(true)
      })

    return () => {
      active = false
    }
  }, [])

  const handleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    event.stopPropagation()

    const id = getRowID(rowData)
    const previous = value
    const next = event.target.value
    const selectedPhotoshoot = photoshoots.find(
      (photoshoot) => String(photoshoot.id) === next,
    )

    setValue(next)
    setSaving(true)
    setError(false)

    if (id === null) {
      setValue(previous)
      setSaving(false)
      setError(true)
      return
    }

    try {
      await updateMedia(id, {
        photoshoot: next ? selectedPhotoshoot?.id ?? null : null,
      })
    } catch (updateError) {
      console.error(updateError)
      setValue(previous)
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onMouseDown={stopRowNavigation}
      style={{
        alignItems: 'center',
        display: 'flex',
        gap: 6,
        minWidth: 170,
      }}
    >
      <select
        aria-label="Photoshoot"
        disabled={saving}
        onChange={handleChange}
        value={value}
        style={{
          background: 'var(--theme-input-bg)',
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: 4,
          color: 'inherit',
          cursor: saving ? 'wait' : 'pointer',
          font: 'inherit',
          maxWidth: 220,
          minHeight: 32,
          padding: '4px 28px 4px 8px',
          width: '100%',
        }}
      >
        <option value="">No photoshoot</option>
        {photoshoots.map((photoshoot) => (
          <option key={photoshoot.id} value={String(photoshoot.id)}>
            {photoshoot.title}
          </option>
        ))}
      </select>
      {saving ? (
        <span aria-label="Saving" title="Saving">…</span>
      ) : error ? (
        <span aria-label="Save failed" title="Save failed">!</span>
      ) : null}
    </div>
  )
}
