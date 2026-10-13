import { spawnSync } from 'node:child_process'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  assertGeneratedStorageAvailable,
  assertFileSizeWithinLimit,
  buildTranscodeArgs,
  getVideoProcessingLimits,
  probeVideo,
  processVideo,
  runProcess,
  validateProbeOutput,
} from './video'

const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg'
const ffprobe = process.env.FFPROBE_PATH || 'ffprobe'
const hasVideoTools =
  spawnSync(ffmpeg, ['-version'], { stdio: 'ignore' }).status === 0 &&
  spawnSync(ffprobe, ['-version'], { stdio: 'ignore' }).status === 0

describe.skipIf(!hasVideoTools)('video processing integration (requires ffmpeg and ffprobe)', () => {
  let directory: string

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'karolg-video-'))
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it('validates, transcodes, and creates poster metadata in a temporary directory', async () => {
    const input = path.join(directory, 'fixture.mov')
    const fixture = spawnSync(ffmpeg, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=c=336699:s=322x242:d=0.5',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=0.5',
      '-shortest',
      '-c:v',
      'libx264',
      '-c:a',
      'aac',
      input,
    ])
    expect(fixture.status, fixture.stderr?.toString()).toBe(0)

    const result = await processVideo({
      inputPath: input,
      mediaId: 17,
      revision: 3,
      mediaRoot: directory,
    })
    const playback = await probeVideo(path.join(directory, result.playbackFilename))

    expect(result).toMatchObject({
      playbackFilename: 'generated/17/r3/playback.mp4',
      playbackMimeType: 'video/mp4',
      posterFilename: 'generated/17/r3/poster.jpg',
      posterMimeType: 'image/jpeg',
      hasAudio: true,
    })
    expect(result.playbackFilesize).toBeGreaterThan(0)
    expect(result.posterWidth % 2).toBe(0)
    expect(result.posterHeight % 2).toBe(0)
    expect(playback.width % 2).toBe(0)
    expect(playback.height % 2).toBe(0)
    expect(Math.max(playback.width, playback.height)).toBeLessThanOrEqual(1920)
    expect(result.transitionColor).toMatch(/^#[0-9a-f]{6}$/)
    expect((await readdir(directory, { recursive: true }))
      .some((filename) => filename.includes('.tmp')))
      .toBe(false)
  })

  it('makes both dimensions even for odd, silent input', async () => {
    const input = path.join(directory, 'odd.mov')
    const fixture = spawnSync(ffmpeg, [
      '-nostdin',
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=c=884422:s=321x241:d=0.4',
      '-c:v',
      'ffv1',
      '-pix_fmt',
      'bgr0',
      input,
    ])
    expect(fixture.status, fixture.stderr?.toString()).toBe(0)

    const result = await processVideo({
      inputPath: input,
      mediaId: 18,
      revision: 1,
      mediaRoot: directory,
    })

    expect(result.hasAudio).toBe(false)
    expect(result.width % 2).toBe(0)
    expect(result.height % 2).toBe(0)
  })

  it('applies rotation metadata before scaling', async () => {
    const base = path.join(directory, 'portrait-base.mp4')
    const input = path.join(directory, 'rotated.mp4')
    const baseFixture = spawnSync(ffmpeg, [
      '-nostdin',
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=c=224466:s=240x320:d=0.4',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      base,
    ])
    expect(baseFixture.status, baseFixture.stderr?.toString()).toBe(0)
    const rotatedFixture = spawnSync(ffmpeg, [
      '-nostdin',
      '-hide_banner',
      '-loglevel',
      'error',
      '-display_rotation:v:0',
      '90',
      '-i',
      base,
      '-c',
      'copy',
      input,
    ])
    expect(rotatedFixture.status, rotatedFixture.stderr?.toString()).toBe(0)
    expect((await probeVideo(input)).rotation).toBe(90)

    const result = await processVideo({
      inputPath: input,
      mediaId: 20,
      revision: 1,
      mediaRoot: directory,
    })

    expect(result.rotation).toBe(0)
    expect(result.width).toBeGreaterThan(result.height)
  })

  it('rejects corrupt input without publishing derivatives', async () => {
    const input = path.join(directory, 'corrupt.mov')
    await writeFile(input, 'not a video')

    await expect(processVideo({
      inputPath: input,
      mediaId: 19,
      revision: 1,
      mediaRoot: directory,
    })).rejects.toThrow()
    expect(await readdir(directory)).toEqual(['corrupt.mov'])
  })
})

describe('video processing resource limits', () => {
  it('times out child processes and bounds output size', async () => {
    await expect(runProcess(process.execPath, [
      '-e',
      'setTimeout(() => {}, 1000)',
    ], { timeoutMs: 20 })).rejects.toThrow('timed out')

    await expect(runProcess(process.execPath, [
      '-e',
      "process.stdout.write('x'.repeat(1000))",
    ], { timeoutMs: 1_000, maxStdoutBytes: 32 })).rejects.toThrow(
      'output exceeded limit',
    )
  })

  it('rejects oversized files, dimensions, duration, streams, and frame rates', () => {
    const limits = getVideoProcessingLimits({ NODE_ENV: 'test' })
    expect(() => assertFileSizeWithinLimit(
      limits.maxOutputBytes + 1,
      limits.maxOutputBytes,
      'Generated playback',
    )).toThrow('size limit')

    const valid = {
      format: { duration: '10', format_name: 'mov,mp4,m4a,3gp,3g2,mj2' },
      streams: [{
        codec_type: 'video',
        width: 1920,
        height: 1080,
        avg_frame_rate: '30/1',
      }],
    }
    expect(validateProbeOutput(valid, limits)).toMatchObject({ frameRate: 30 })
    expect(() => validateProbeOutput({
      ...valid,
      streams: [{ ...valid.streams[0], width: limits.maxDimension + 1 }],
    }, limits)).toThrow('dimensions')
    expect(() => validateProbeOutput({
      ...valid,
      format: {
        ...valid.format,
        duration: String(limits.maxDurationSeconds + 1),
      },
    }, limits)).toThrow('duration')
    expect(() => validateProbeOutput({
      ...valid,
      streams: Array.from({ length: limits.maxStreams + 1 }, (_, index) =>
        index === 0 ? valid.streams[0] : { codec_type: 'audio' }),
    }, limits)).toThrow('too many streams')
    expect(() => validateProbeOutput({
      ...valid,
      streams: [{
        ...valid.streams[0],
        avg_frame_rate: `${limits.maxFrameRate + 1}/1`,
      }],
    }, limits)).toThrow('frame rate')
    expect(() => validateProbeOutput({
      ...valid,
      format: { ...valid.format, format_name: 'avi' },
    }, limits)).toThrow('container')
    expect(() => validateProbeOutput(valid, limits, 'disguised.webm'))
      .toThrow('container')
  })

  it('preemptively caps duration, output bytes, protocols, and worker threads', () => {
    const limits = getVideoProcessingLimits({
      NODE_ENV: 'test',
      VIDEO_THREADS: '8',
    })
    const args = buildTranscodeArgs({
      inputPath: '/tmp/input.mov',
      outputPath: '/tmp/output.mp4',
      hasAudio: false,
      limits,
    })

    expect(args).toContain('-fs')
    expect(args[args.indexOf('-fs') + 1]).toBe(String(limits.maxOutputBytes))
    expect(args).toContain('-t')
    expect(args[args.indexOf('-t') + 1]).toBe(String(limits.maxDurationSeconds))
    expect(args[args.indexOf('-threads') + 1]).toBe('8')
    expect(args[args.indexOf('-protocol_whitelist') + 1]).toBe('file')
    expect(args.join(' ')).not.toContain('pipe')
    expect(getVideoProcessingLimits({
      NODE_ENV: 'test',
      VIDEO_THREADS: '9',
    }).threads).toBe(2)
  })

  it('uses lower operational defaults and enforces generated storage quota', () => {
    const limits = getVideoProcessingLimits({ NODE_ENV: 'test' })
    expect(limits).toMatchObject({
      maxDurationSeconds: 600,
      maxDimension: 8_192,
      maxPixels: 33_500_000,
      maxFrameRate: 60,
      threads: 2,
    })
    expect(() => assertGeneratedStorageAvailable(900, 101, 1_000))
      .toThrow('storage quota')
    expect(() => assertGeneratedStorageAvailable(900, 100, 1_000))
      .not.toThrow()
  })
})
