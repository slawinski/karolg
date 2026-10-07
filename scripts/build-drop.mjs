import { access, copyFile, rename, rm } from 'node:fs/promises'
import { constants } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const payloadApp = path.join(root, 'src', 'app', '(payload)')
const parkedPayloadApp = path.join(root, '.drop-payload-app')
const portfolioFile = path.join(root, 'src', 'lib', 'portfolio.ts')
const staticPortfolioFile = path.join(root, 'src', 'lib', 'portfolio.static.ts')
const parkedPortfolioFile = path.join(root, '.drop-portfolio.ts')
const outDir = path.join(root, 'out')
const nextDir = path.join(root, '.next')

const exists = async (target) => {
  try {
    await access(target, constants.F_OK)
    return true
  } catch {
    return false
  }
}

await rm(outDir, { recursive: true, force: true })
await rm(nextDir, { recursive: true, force: true })

let payloadWasParked = false
let portfolioWasSwapped = false

try {
  if (await exists(parkedPayloadApp)) {
    throw new Error(
      'Found .drop-payload-app from an earlier interrupted build. Restore or remove it before continuing.',
    )
  }

  if (await exists(parkedPortfolioFile)) {
    throw new Error(
      'Found .drop-portfolio.ts from an earlier interrupted build. Restore or remove it before continuing.',
    )
  }

  if (await exists(payloadApp)) {
    await rename(payloadApp, parkedPayloadApp)
    payloadWasParked = true
  }

  await rename(portfolioFile, parkedPortfolioFile)
  await copyFile(staticPortfolioFile, portfolioFile)
  portfolioWasSwapped = true

  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(command, ['exec', 'next', 'build'], {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        STATIC_EXPORT: '1',
        NODE_OPTIONS: '--no-deprecation --max-old-space-size=4096',
      },
    })

    child.on('error', reject)
    child.on('exit', (code) => resolve(code ?? 1))
  })

  if (exitCode !== 0) {
    process.exitCode = exitCode
  } else {
    console.log('\nStatic Cloudflare Drop build ready in ./out')
  }
} finally {
  if (portfolioWasSwapped) {
    await rm(portfolioFile, { force: true })
    if (await exists(parkedPortfolioFile)) {
      await rename(parkedPortfolioFile, portfolioFile)
    }
  }

  if (payloadWasParked && (await exists(parkedPayloadApp))) {
    await rename(parkedPayloadApp, payloadApp)
  }
}
