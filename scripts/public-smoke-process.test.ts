import { execFileSync, spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { expect, it } from 'vitest'
import { stopSmokeChild } from './public-smoke-fixture'

function workerIsRunning(pid: number) {
  // Orphaned zombies can remain visible until the OS/container init reaps them.
  const rows = execFileSync('ps', ['-axo', 'pid=,stat='], { encoding: 'utf8' })
  return rows.split('\n').some((row) => {
    const [id, state] = row.trim().split(/\s+/)
    return Number(id) === pid && !state.startsWith('Z')
  })
}

it.each([true, false])('drains a TERM-resistant worker when leader exits before cleanup: %s', async (exitsFirst) => {
  const workerCode = `process.on('SIGTERM', () => {}); console.log(process.pid); setInterval(() => {}, 1000)`
  const leaderCode = `
    const { spawn } = require('node:child_process');
    const worker = spawn(process.execPath, ['-e', ${JSON.stringify(workerCode)}], { stdio: ['ignore', 'pipe', 'ignore'] });
    worker.stdout.once('data', data => {
      process.stdout.write(data, () => { ${exitsFirst ? 'process.exit(0)' : ''} });
    });
    setInterval(() => {}, 1000);
  `
  const leader = spawn(process.execPath, ['-e', leaderCode], { detached: true, stdio: ['ignore', 'pipe', 'ignore'] })
  const exit = once(leader, 'exit')
  let workerPid = 0
  try {
    const [output] = await once(leader.stdout!, 'data', { signal: AbortSignal.timeout(5000) })
    workerPid = Number(output.toString().trim())
    expect(workerPid).toBeGreaterThan(0)
    if (exitsFirst) await exit
    expect(workerIsRunning(workerPid)).toBe(true)
    await stopSmokeChild(leader)
    expect(leader.exitCode !== null || leader.signalCode !== null).toBe(true)
    expect(workerIsRunning(workerPid)).toBe(false)
  } finally {
    try { process.kill(-leader.pid!, 'SIGKILL') } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
    }
    await exit
    if (workerPid) {
      const deadline = Date.now() + 5000
      while (workerIsRunning(workerPid) && Date.now() < deadline) await delay(50)
      expect(workerIsRunning(workerPid), 'test must not leave a running worker').toBe(false)
    }
  }
}, 30_000)
