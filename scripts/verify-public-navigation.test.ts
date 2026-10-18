import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'

it('checks sitemap paths and queries on BASE, not the canonical origin', async () => {
  const requests: string[] = []
  const server = createServer((request, response) => {
    requests.push(request.url!)
    if (request.url === '/sitemap.xml') {
      response.end('<urlset><url><loc>https://canonical.invalid/work/ok?revision=2&amp;view=full</loc></url><url><loc>https://canonical.invalid/work/broken</loc></url></urlset>')
    } else {
      response.statusCode = request.url === '/work/broken' ? 500 : 200
      response.end('<h1>Project</h1>')
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as import('node:net').AddressInfo
  const base = `http://127.0.0.1:${address.port}`
  const directory = await mkdtemp(join(tmpdir(), 'navigation-review-'))
  const output = join(directory, 'report.json')
  try {
    await expect(promisify(execFile)(process.execPath, ['scripts/verify-public-navigation.mjs', base, output]))
      .rejects.toThrow(`Route failed: ${base}/work/broken`)
    expect(requests).toEqual(['/sitemap.xml', '/work/ok?revision=2&view=full', '/work/broken'])
    expect(JSON.parse(await readFile(output, 'utf8')).routes).toEqual([
      { path: '/work/ok', url: `${base}/work/ok?revision=2&view=full`, status: 200 },
      { path: '/work/broken', url: `${base}/work/broken`, status: 500 },
    ])
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await rm(directory, { recursive: true, force: true })
  }
})

it.each([
  { status: 500, body: '<urlset><url><loc>https://canonical.invalid/</loc></url></urlset>', error: 'Sitemap discovery failed' },
  { status: 200, body: '<urlset></urlset>', error: 'Sitemap URL list is empty' },
  { status: 200, body: '<urlset><url><loc>not a URL</loc></url></urlset>', error: 'Invalid URL' },
])('rejects unusable sitemap discovery: $status $body', async ({ status, body, error }) => {
  const requests: string[] = []
  const server = createServer((request, response) => {
    requests.push(request.url!)
    response.statusCode = status
    response.end(body)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as import('node:net').AddressInfo
  const directory = await mkdtemp(join(tmpdir(), 'navigation-review-'))
  try {
    await expect(promisify(execFile)(process.execPath, ['scripts/verify-public-navigation.mjs',
      `http://127.0.0.1:${address.port}`, join(directory, 'report.json')])).rejects.toThrow(error)
    expect(requests).toEqual(['/sitemap.xml'])
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await rm(directory, { recursive: true, force: true })
  }
})
