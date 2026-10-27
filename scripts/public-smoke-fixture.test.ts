import { ChildProcess } from 'node:child_process'
import { lstatSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { assertSmokeCheckout, stopSmokeChild, waitForSmokeChild } from './public-smoke-fixture'

vi.mock('node:fs', () => ({ lstatSync: vi.fn() }))

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it.each(['.env', '.env.local', '.env.production', '.env.production.local'])(
  'refuses %s by existence without opening it', (filename) => {
    vi.mocked(lstatSync).mockImplementation((target) => {
      if (target === `/checkout/${filename}`) return {} as ReturnType<typeof lstatSync>
      throw Object.assign(new Error('absent'), { code: 'ENOENT' })
    })
    expect(() => assertSmokeCheckout('/checkout')).toThrow(filename)
  },
)

it('accepts a clean checkout', () => {
  vi.mocked(lstatSync).mockImplementation(() => {
    throw Object.assign(new Error('absent'), { code: 'ENOENT' })
  })
  expect(() => assertSmokeCheckout('/checkout')).not.toThrow()
})

it('does not treat an unreadable existence check as a clean checkout', () => {
  vi.mocked(lstatSync).mockImplementation(() => {
    throw Object.assign(new Error('permission denied'), { code: 'EACCES' })
  })
  expect(() => assertSmokeCheckout('/checkout')).toThrow('permission denied')
})

it('rejects command failure and missing executables', async () => {
  const failed = new ChildProcess()
  const result = waitForSmokeChild(failed, 1000)
  failed.emit('exit', 1, null)
  await expect(result).rejects.toThrow('exit 1')
  const missing = new ChildProcess()
  const missingResult = waitForSmokeChild(missing, 1000)
  missing.emit('error', new Error('spawn ffmpeg ENOENT'))
  await expect(missingResult).rejects.toThrow('ffmpeg ENOENT')
})

it('bounds a hung command', async () => {
  vi.useFakeTimers()
  const result = waitForSmokeChild(new ChildProcess(), 1000)
  const assertion = expect(result).rejects.toThrow('timed out')
  await vi.advanceTimersByTimeAsync(1000)
  await assertion
})

it('terminates an owned process group and escalates a stuck child', async () => {
  vi.useFakeTimers()
  const child = new ChildProcess()
  Object.defineProperty(child, 'pid', { value: 12345 })
  const kill = vi.spyOn(process, 'kill').mockImplementation(() => true)
  const stopped = stopSmokeChild(child)
  expect(kill).toHaveBeenCalledWith(-12345, 'SIGTERM')
  await vi.advanceTimersByTimeAsync(5000)
  expect(kill).toHaveBeenCalledWith(-12345, 'SIGKILL')
  Object.defineProperty(child, 'exitCode', { value: 0 })
  child.emit('exit', 0, null)
  await stopped
})

it('does not signal a child that already exited', async () => {
  const child = new ChildProcess()
  Object.defineProperty(child, 'pid', { value: 12345 })
  Object.defineProperty(child, 'exitCode', { value: 1 })
  const kill = vi.spyOn(process, 'kill')
  await stopSmokeChild(child)
  expect(kill).not.toHaveBeenCalled()
})
