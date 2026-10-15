'use client'

import { useAuth } from '@payloadcms/ui'
import type { DefaultCellComponentProps } from 'payload'
import { useEffect, useMemo, useState } from 'react'
import {
  canUpdatePhotoshoots,
  getRelationshipID,
  getRelationshipIDs,
} from './PhotoshootListCellUtils'

type PhotographerOption = {
  id: string | number
  displayName: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

let photographersPromise: Promise<PhotographerOption[]> | null = null

const getEmbeddedPhotographers = (value: unknown): PhotographerOption[] => {
  const values = Array.isArray(value) ? value : value == null ? [] : [value]

  return values.flatMap((item) => {
    if (!item || typeof item !== 'object') return []

    const record = item as Record<string, unknown>
    const id = getRelationshipID(record)
    if (!id || typeof record.displayName !== 'string') return []

    return [{
      id: typeof record.id === 'string' || typeof record.id === 'number' ? record.id : id,
      displayName: record.displayName,
    }]
  })
}

const mergePhotographers = (
  first: PhotographerOption[],
  second: PhotographerOption[],
) => {
  const byID = new Map<string, PhotographerOption>()
  for (const photographer of [...first, ...second]) {
    byID.set(String(photographer.id), photographer)
  }
  return [...byID.values()]
}

const getRowID = (rowData: DefaultCellComponentProps['rowData']) => {
  const id = rowData?.id
  return typeof id === 'string' || typeof id === 'number' ? id : null
}

const loadPhotographers = async () => {
  if (!photographersPromise) {
    const request = fetch(
      '/api/photographers?pagination=false&sort=displayName&depth=0',
      { credentials: 'include' },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load photographers')

        const data = (await response.json()) as {
          docs?: Array<{ id: string | number; displayName?: string }>
        }

        return (data.docs || []).map((doc) => ({
          id: doc.id,
          displayName: doc.displayName || 'Unnamed photographer',
        }))
      })
      .catch((error) => {
        throw error
      })
    photographersPromise = request
    void request.finally(() => {
      if (photographersPromise === request) photographersPromise = null
    }).catch(() => {})
  }

  return photographersPromise
}

export const updatePhotoshootPhotographers = async (
  id: string | number,
  photographerIDs: Array<string | number>,
) => {
  const response = await fetch(`/api/projects/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ photographers: photographerIDs }),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(
      `Could not update photoshoot (${response.status})${details ? `: ${details}` : ''}`,
    )
  }

  return response.json()
}

const stopRowNavigation = (event: React.SyntheticEvent) => {
  event.stopPropagation()
}

export function PhotographersCell({
  cellData,
  rowData,
}: DefaultCellComponentProps) {
  const { permissions } = useAuth()
  const editable = canUpdatePhotoshoots(permissions)
  const embeddedPhotographers = useMemo(
    () => getEmbeddedPhotographers(cellData),
    [cellData],
  )
  const [photographers, setPhotographers] = useState(embeddedPhotographers)
  const [value, setValue] = useState(() => getRelationshipIDs(cellData))
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [loadFailed, setLoadFailed] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    setValue(getRelationshipIDs(cellData))
    setPhotographers((current) => mergePhotographers(current, embeddedPhotographers))
    setStatus('idle')
  }, [cellData, embeddedPhotographers])

  useEffect(() => {
    let active = true

    void loadPhotographers()
      .then((options) => {
        if (active) {
          setPhotographers((current) => mergePhotographers(current, options))
          setLoadFailed(false)
        }
      })
      .catch(() => {
        if (active) setLoadFailed(true)
      })

    return () => {
      active = false
    }
  }, [loadAttempt])

  const selectedNames = value.map((id) =>
    photographers.find((photographer) => String(photographer.id) === id)?.displayName || id,
  )

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()

    const id = getRowID(rowData)
    const previous = value
    const selectedID = event.currentTarget.value
    const next = event.currentTarget.checked
      ? [...new Set([...value, selectedID])]
      : value.filter((id) => id !== selectedID)
    const nextIDs = next.map((selectedID) =>
      photographers.find((photographer) => String(photographer.id) === selectedID)?.id ?? selectedID,
    )

    setValue(next)
    setStatus('saving')

    if (id === null) {
      setValue(previous)
      setStatus('error')
      return
    }

    try {
      await updatePhotoshootPhotographers(id, nextIDs)
      setStatus('saved')
    } catch (error) {
      console.error(error)
      setValue(previous)
      setStatus('error')
    }
  }

  const disabled = !editable || status === 'saving' || loadFailed

  return (
    <div
      onClick={stopRowNavigation}
      onMouseDown={stopRowNavigation}
      style={{
        display: 'grid',
        gap: 5,
        minWidth: 210,
      }}
    >
      <span title={selectedNames.join(', ')}>
        {selectedNames.length > 0 ? selectedNames.join(', ') : 'No photographers'}
      </span>
      <details>
        <summary
          style={{ cursor: editable ? 'pointer' : 'not-allowed' }}
          title={editable ? 'Edit photographers' : 'You cannot update photoshoots'}
        >
          Edit photographers
        </summary>
        <fieldset
          aria-label="Photographers"
          disabled={disabled}
          style={{
            border: '1px solid var(--theme-elevation-150)',
            display: 'grid',
            gap: 6,
            margin: '6px 0 0',
            maxWidth: 240,
            padding: 8,
          }}
        >
          {photographers.length > 0 ? photographers.map((photographer) => {
            const photographerID = String(photographer.id)
            return (
              <label key={photographer.id} style={{ alignItems: 'center', display: 'flex', gap: 6 }}>
                <input
                  checked={value.includes(photographerID)}
                  disabled={disabled}
                  onChange={handleChange}
                  type="checkbox"
                  value={photographerID}
                />
                {photographer.displayName}
              </label>
            )
          }) : <span>No photographers available</span>}
        </fieldset>
      </details>
      <span aria-live="polite" style={{ minHeight: '1em' }}>
        {status === 'saving'
          ? 'Saving'
          : status === 'saved'
            ? 'Saved'
            : status === 'error'
              ? 'Save failed'
              : loadFailed
                ? 'Could not load photographers'
                : ''}
      </span>
      {loadFailed ? (
        <button
          onClick={(event) => {
            event.stopPropagation()
            setLoadFailed(false)
            setLoadAttempt((attempt) => attempt + 1)
          }}
          type="button"
        >
          Retry
        </button>
      ) : null}
    </div>
  )
}
