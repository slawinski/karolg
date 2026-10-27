import { afterEach, expect, it, vi } from 'vitest'
import type { PublicSmokeFixture } from './public-smoke-fixture'

const mocks = vi.hoisted(() => ({ launch: vi.fn() }))
vi.mock('playwright', () => ({ chromium: { launch: mocks.launch } }))
import { browserScenarios, runPublicSmokeJourney } from './public-smoke-journey'

afterEach(() => {
  vi.resetAllMocks()
  for (const scenario of browserScenarios) {
    scenario.status = 'not-run'
    scenario.step = 'context'
    scenario.error = null
    scenario.evidence = []
    scenario.evidenceErrors = []
    for (const name of Object.keys(scenario.checks)) scenario.checks[name] = 'not-run'
  }
})

it.each([false, true])('preserves the browser assertion when evidence capture fails: %s', async (captureFails) => {
  const primary = new Error('controlled navigation assertion')
  const capture = (name: string) => vi.fn(async () => {
    if (captureFails) throw new Error(`${name} unavailable`)
  })
  const screenshot = capture('screenshot')
  const stop = capture('trace')
  const page = {
    setDefaultTimeout: vi.fn(), setDefaultNavigationTimeout: vi.fn(), on: vi.fn(),
    url: () => 'http://127.0.0.1:3000/work/fixture',
    goto: vi.fn().mockRejectedValue(primary), screenshot,
  }
  const context = {
    tracing: { start: vi.fn(), stop }, newPage: vi.fn().mockResolvedValue(page),
    close: capture('context close'),
  }
  mocks.launch.mockResolvedValue({ newContext: vi.fn().mockResolvedValue(context), close: capture('browser close') })
  // Only these identities are used before the deliberately failing first navigation.
  const fixture = { story: { slug: 'fixture' }, video: { playbackUrl: '/api/media/4/playback' } } as PublicSmokeFixture
  const progress = vi.fn(async () => {})
  await expect(runPublicSmokeJourney('http://127.0.0.1:3000', fixture, '/evidence', progress)).rejects.toBe(primary)
  const [mobile, desktop, reduced] = browserScenarios
  expect(mobile).toMatchObject({ status: 'failed', step: 'home',
    url: 'http://127.0.0.1:3000/work/fixture', viewport: { width: 390, height: 844 },
    checks: { home: 'failed', 'pointer-story': 'not-run' } })
  expect(mobile.error).toContain(primary.message)
  expect(desktop.status).toBe('not-run')
  expect(reduced.status).toBe('not-run')
  expect(screenshot).toHaveBeenCalledWith({ path: '/evidence/mobile-failure.png', timeout: 5000 })
  expect(stop).toHaveBeenCalledWith({ path: '/evidence/mobile-trace.zip' })
  if (captureFails) {
    expect(mobile.evidence).toEqual([])
    expect(mobile.evidenceErrors.join('\n')).toContain('screenshot unavailable')
    expect(mobile.evidenceErrors.join('\n')).toContain('trace unavailable')
    expect(mobile.evidenceErrors.join('\n')).toContain('context close unavailable')
  } else {
    expect(mobile.evidence).toEqual(['mobile-failure.png', 'mobile-trace.zip'])
    expect(mobile.evidenceErrors).toEqual([])
  }
  expect(progress).toHaveBeenLastCalledWith(mobile)
})

it('leaves mandatory scenarios not-run when Chromium cannot launch', async () => {
  mocks.launch.mockRejectedValue(new Error('Chromium missing'))
  await expect(runPublicSmokeJourney('http://127.0.0.1:3000', {} as PublicSmokeFixture,
    '/evidence', async () => {})).rejects.toThrow('Chromium missing')
  expect(browserScenarios.every((scenario) => scenario.status === 'not-run' &&
    Object.values(scenario.checks).every((status) => status === 'not-run'))).toBe(true)
})
