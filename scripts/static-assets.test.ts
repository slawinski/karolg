import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { copyStaticAssets, createAssetManifest } from './static-assets.mjs'

describe('static export media assets', () => {
  let directory: string
  let mediaDir: string
  let outDir: string

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'karolg-assets-'))
    mediaDir = path.join(directory, 'media')
    outDir = path.join(directory, 'out')
    await Promise.all([mkdir(mediaDir), mkdir(outDir)])
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it('copies image originals and video derivatives without private video originals', async () => {
    const manifest = createAssetManifest([
      { id: 1, kind: 'image', processingStatus: 'ready', filename: 'photo.jpg' },
      {
        id: 2,
        kind: 'video',
        processingStatus: 'ready',
        filename: 'clip.mov',
        playbackFilename: 'generated/2/r1/playback.mp4',
        posterFilename: 'generated/2/r1/poster.jpg',
      },
      { id: 3, kind: 'image', filename: 'photo.jpg' },
    ])
    expect(manifest).toEqual([
      'generated/2/r1/playback.mp4',
      'generated/2/r1/poster.jpg',
      'photo.jpg',
    ])

    for (const filename of manifest) {
      await mkdir(path.dirname(path.join(mediaDir, filename)), { recursive: true })
      await writeFile(path.join(mediaDir, filename), filename)
    }
    await writeFile(path.join(mediaDir, 'unreferenced.jpg'), 'no')

    await copyStaticAssets({ manifest, sourceDir: mediaDir, outDir })
    await expect(readFile(
      path.join(outDir, 'media', 'generated/2/r1/playback.mp4'),
      'utf8',
    )).resolves.toBe('generated/2/r1/playback.mp4')
    await expect(readFile(path.join(outDir, 'media', 'unreferenced.jpg')))
      .rejects.toThrow()
  })

  it('rejects incomplete ready videos and missing referenced files', async () => {
    expect(() => createAssetManifest([
      { id: 4, kind: 'video', processingStatus: 'ready', filename: 'clip.mov' },
    ])).toThrow('requires playback and poster')
    expect(() => createAssetManifest([
      { id: 5, kind: 'image', processingStatus: 'ready', filename: '../secret' },
    ])).toThrow('Unsafe media filename')

    await expect(copyStaticAssets({
      manifest: ['missing.jpg'],
      sourceDir: mediaDir,
      outDir,
    })).rejects.toThrow('missing referenced media asset')
  })
})
