import * as PayloadUI from '@payloadcms/ui'
import type { DefaultCellComponentProps } from 'payload'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from 'vitest-browser-react'
import { PhotographersCell } from './PhotoshootListCells'

vi.mock('@payloadcms/ui', () => ({ useAuth: vi.fn() }))

const photographers = [
  { id: 1, displayName: 'Ada Adams' },
  { id: 2, displayName: 'Ben Brooks' },
  { id: 3, displayName: 'Cy Chen' },
]

const props = (cellData: unknown): DefaultCellComponentProps => ({
  cellData,
  rowData: { id: 42 },
} as unknown as DefaultCellComponentProps)

const togglePhotographer = async (id: string) => {
  const input = document.querySelector<HTMLInputElement>(`input[type="checkbox"][value="${id}"]`)!
  await act(async () => {
    input.click()
  })
}

beforeEach(() => {
  vi.mocked(PayloadUI.useAuth).mockReturnValue({
    permissions: {
      collections: { projects: { fields: true, update: true } },
    },
  } as unknown as ReturnType<typeof PayloadUI.useAuth>)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ docs: photographers }))))
})

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  await cleanup()
})

describe('PhotographersCell', () => {
  it('displays assigned names and loads every photographer without a fixed limit', async () => {
    await render(<PhotographersCell {...props([{ id: 1, displayName: 'Ada Adams' }])} />)

    await expect.element(document.body).toHaveTextContent('Ada Adams')
    await vi.waitFor(() => {
      expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(3)
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/photographers?pagination=false&sort=displayName&depth=0',
      { credentials: 'include' },
    )
  })

  it('PATCHes multiple relationship IDs and reports saving and saved states', async () => {
    let finishSave: ((response: Response) => void) | undefined
    const saveResponse = new Promise<Response>((resolve) => {
      finishSave = resolve
    })
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PATCH') return saveResponse
      return new Response(JSON.stringify({ docs: photographers }))
    }))
    await render(<PhotographersCell {...props([1])} />)
    await vi.waitFor(() => expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(3))

    await togglePhotographer('2')
    await expect.element(document.body).toHaveTextContent('Saving')

    const patchCall = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(patchCall?.[0]).toBe('/api/projects/42')
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({ photographers: [1, 2] })

    finishSave!(new Response(JSON.stringify({ doc: { id: 42 } })))
    await expect.element(document.body).toHaveTextContent('Saved')
    await expect.element(document.body).toHaveTextContent('Ada Adams, Ben Brooks')
  })

  it('rolls the selection back and reports a failed save', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PATCH') return new Response('No', { status: 500 })
      return new Response(JSON.stringify({ docs: photographers }))
    }))
    await render(<PhotographersCell {...props([1])} />)
    await vi.waitFor(() => expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(3))

    await togglePhotographer('2')

    await expect.element(document.body).toHaveTextContent('Save failed')
    expect(document.querySelector<HTMLInputElement>('input[value="1"]')?.checked).toBe(true)
    expect(document.querySelector<HTMLInputElement>('input[value="2"]')?.checked).toBe(false)
    await expect.element(document.body).toHaveTextContent('Ada Adams')
  })

  it('disables editing when projects.update is not granted', async () => {
    vi.mocked(PayloadUI.useAuth).mockReturnValue({
      permissions: { collections: { projects: { fields: true } } },
    } as unknown as ReturnType<typeof PayloadUI.useAuth>)
    await render(<PhotographersCell {...props([1])} />)

    await vi.waitFor(() => expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(3))
    expect(document.querySelector<HTMLInputElement>('input[value="1"]')?.disabled).toBe(true)
    expect(document.querySelector('summary')?.title).toBe('You cannot update photoshoots')
  })

  it('can clear the final photographer assignment', async () => {
    await render(<PhotographersCell {...props([1])} />)
    await vi.waitFor(() => expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(3))

    await togglePhotographer('1')

    const patchCall = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({ photographers: [] })
    await expect.element(document.body).toHaveTextContent('No photographers')
  })

  it('retries a failed photographer-options request', async () => {
    let attempts = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      attempts += 1
      return attempts === 1
        ? new Response('Unavailable', { status: 503 })
        : new Response(JSON.stringify({ docs: photographers }))
    }))
    await render(<PhotographersCell {...props([{ id: 1, displayName: 'Ada Adams' }])} />)

    await expect.element(document.body).toHaveTextContent('Could not load photographers')
    document.querySelector<HTMLButtonElement>('button')?.click()

    await vi.waitFor(() => expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(3))
    expect(attempts).toBe(2)
    await expect.element(document.body).toHaveTextContent('Ada Adams')
  })
})
