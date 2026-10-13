import { spawn } from 'node:child_process'
import { link, mkdir, readdir, rm, rmdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { deriveTransitionColor } from './color'
import {
  derivativeRelativePath,
  GENERATED_MEDIA_ROOT,
  resolveContainedMediaPath,
} from './paths'

type VideoStream = {
  codec_type?: string
  width?: number
  height?: number
  duration?: string
  avg_frame_rate?: string
  r_frame_rate?: string
  tags?: { rotate?: string }
  side_data_list?: Array<{ rotation?: number }>
}

type ProbeOutput = {
  format?: { duration?: string; format_name?: string; size?: string }
  streams?: VideoStream[]
}

export type VideoProbe = {
  duration: number
  width: number
  height: number
  rotation: number
  hasAudio: boolean
  frameRate: number
  streamCount: number
  formatName: string
}

export type VideoProcessingLimits = {
  maxInputBytes: number
  maxOutputBytes: number
  maxDurationSeconds: number
  maxDimension: number
  maxPixels: number
  maxStreams: number
  maxFrameRate: number
  probeTimeoutMs: number
  transcodeTimeoutMs: number
  posterTimeoutMs: number
  threads: number
  maxGeneratedBytes: number
}

export type ProcessedVideo = VideoProbe & {
  playbackFilename: string
  playbackMimeType: 'video/mp4'
  playbackFilesize: number
  posterFilename: string
  posterMimeType: 'image/jpeg'
  posterWidth: number
  posterHeight: number
  transitionColor: string | null
}

type ProcessVideoOptions = {
  inputPath: string
  mediaId: number
  revision: number
  mediaRoot?: string
  limits?: VideoProcessingLimits
}

type RunProcessOptions = {
  timeoutMs: number
  maxStdoutBytes?: number
  maxStderrBytes?: number
}

const MIB = 1024 * 1024

const boundedInteger = (
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) => {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback
}

export function getVideoProcessingLimits(
  env: NodeJS.ProcessEnv = process.env,
): VideoProcessingLimits {
  return {
    maxInputBytes: boundedInteger(env.VIDEO_MAX_INPUT_BYTES, 512 * MIB, MIB, 2_048 * MIB),
    maxOutputBytes: boundedInteger(env.VIDEO_MAX_OUTPUT_BYTES, 512 * MIB, MIB, 2_048 * MIB),
    maxDurationSeconds: boundedInteger(env.VIDEO_MAX_DURATION_SECONDS, 600, 1, 3_600),
    maxDimension: boundedInteger(env.VIDEO_MAX_DIMENSION, 8_192, 64, 16_384),
    maxPixels: boundedInteger(env.VIDEO_MAX_PIXELS, 33_500_000, 4_096, 100_000_000),
    maxStreams: boundedInteger(env.VIDEO_MAX_STREAMS, 8, 1, 32),
    maxFrameRate: boundedInteger(env.VIDEO_MAX_FRAME_RATE, 60, 1, 120),
    probeTimeoutMs: boundedInteger(env.VIDEO_PROBE_TIMEOUT_MS, 30_000, 1_000, 120_000),
    transcodeTimeoutMs: boundedInteger(
      env.VIDEO_TRANSCODE_TIMEOUT_MS,
      30 * 60_000,
      10_000,
      60 * 60_000,
    ),
    posterTimeoutMs: boundedInteger(env.VIDEO_POSTER_TIMEOUT_MS, 120_000, 1_000, 300_000),
    threads: boundedInteger(env.VIDEO_THREADS, 2, 1, 8),
    maxGeneratedBytes: boundedInteger(
      env.VIDEO_GENERATED_QUOTA_BYTES,
      20 * 1024 * MIB,
      512 * MIB,
      1024 * 1024 * MIB,
    ),
  }
}

const executable = (name: 'ffmpeg' | 'ffprobe') =>
  name === 'ffmpeg'
    ? process.env.FFMPEG_PATH || 'ffmpeg'
    : process.env.FFPROBE_PATH || 'ffprobe'

const appendTail = (current: Buffer, chunk: Buffer, maximum: number) => {
  const combined = Buffer.concat([current, chunk])
  return combined.length <= maximum ? combined : combined.subarray(combined.length - maximum)
}

export const runProcess = (
  command: string,
  args: string[],
  {
    timeoutMs,
    maxStdoutBytes = 256 * 1024,
    maxStderrBytes = 64 * 1024,
  }: RunProcessOptions,
) => new Promise<string>((resolve, reject) => {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = Buffer.alloc(0)
  let stderr = Buffer.alloc(0)
  let stdoutBytes = 0
  let settled = false

  const finish = (error?: Error) => {
    if (settled) return
    settled = true
    clearTimeout(timeout)
    if (error) reject(error)
    else resolve(stdout.toString('utf8'))
  }

  child.stdout.on('data', (chunk: Buffer) => {
    stdoutBytes += chunk.length
    stdout = appendTail(stdout, chunk, maxStdoutBytes)
    if (stdoutBytes > maxStdoutBytes) {
      child.kill('SIGKILL')
      finish(new Error(`${path.basename(command)} output exceeded limit`))
    }
  })
  child.stderr.on('data', (chunk: Buffer) => {
    stderr = appendTail(stderr, chunk, maxStderrBytes)
  })
  child.on('error', (error) => finish(error))
  child.on('close', (code) => {
    if (settled) return
    if (code === 0) {
      finish()
      return
    }
    const details = stderr.toString('utf8').trim().replace(/\s+/g, ' ').slice(-2_000)
    finish(new Error(
      `${path.basename(command)} exited with code ${code}${details ? `: ${details}` : ''}`,
    ))
  })

  const timeout = setTimeout(() => {
    child.kill('SIGKILL')
    finish(new Error(`${path.basename(command)} timed out`))
  }, timeoutMs)
})

const finitePositive = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const parseFrameRate = (value: string | undefined) => {
  if (!value) return null
  const [numerator, denominator = '1'] = value.split('/')
  const top = Number(numerator)
  const bottom = Number(denominator)
  const result = bottom ? top / bottom : Number.NaN
  return Number.isFinite(result) && result > 0 ? result : null
}

const normalizedRotation = (stream: VideoStream) => {
  const raw =
    stream.side_data_list?.find((item) => Number.isFinite(item.rotation))?.rotation ??
    Number.parseFloat(stream.tags?.rotate || '0')
  return ((Math.round(raw / 90) * 90) % 360 + 360) % 360
}

export function assertFileSizeWithinLimit(
  size: number,
  limit: number,
  label: string,
) {
  if (!Number.isSafeInteger(size) || size < 1 || size > limit) {
    throw new Error(`${label} exceeds configured size limit`)
  }
}

export function validateProbeOutput(
  output: ProbeOutput,
  limits: VideoProcessingLimits,
  inputPath = 'input.mp4',
): VideoProbe {
  const streams = output.streams || []
  const videoStreams = streams.filter((stream) => stream.codec_type === 'video')
  const video = videoStreams[0]
  const width = finitePositive(video?.width)
  const height = finitePositive(video?.height)
  const duration = finitePositive(output.format?.duration) ?? finitePositive(video?.duration)
  const frameRate = parseFrameRate(video?.avg_frame_rate) ??
    parseFrameRate(video?.r_frame_rate)
  const formatName = output.format?.format_name?.toLowerCase() || ''
  const formats = new Set(formatName.split(',').filter(Boolean))
  const extension = path.extname(inputPath).toLowerCase()
  const movFamily = ['.mov', '.mp4', '.m4v'].includes(extension)
  const webmFamily = ['.webm', '.mkv'].includes(extension)
  const validContainer =
    (movFamily && ['mov', 'mp4', 'm4v'].some((format) => formats.has(format))) ||
    (webmFamily && ['matroska', 'webm'].some((format) => formats.has(format)))

  if (!video || videoStreams.length !== 1 || !width || !height || !duration || !frameRate) {
    throw new Error('Input must contain one valid video stream')
  }
  if (!validContainer) throw new Error('Input video container is not allowed')
  if (streams.length > limits.maxStreams) throw new Error('Input has too many streams')
  if (duration > limits.maxDurationSeconds) throw new Error('Input duration exceeds limit')
  if (
    width > limits.maxDimension ||
    height > limits.maxDimension ||
    width * height > limits.maxPixels
  ) {
    throw new Error('Input dimensions exceed limit')
  }
  if (frameRate > limits.maxFrameRate) throw new Error('Input frame rate exceeds limit')

  return {
    duration,
    width,
    height,
    rotation: normalizedRotation(video),
    hasAudio: streams.some((stream) => stream.codec_type === 'audio'),
    frameRate,
    streamCount: streams.length,
    formatName,
  }
}

export async function probeVideo(
  inputPath: string,
  limits = getVideoProcessingLimits(),
): Promise<VideoProbe> {
  const stdout = await runProcess(executable('ffprobe'), [
    '-v',
    'error',
    '-protocol_whitelist',
    'file',
    '-show_entries',
    'format=duration,size,format_name:stream=codec_type,width,height,duration,avg_frame_rate,r_frame_rate:stream_tags=rotate:stream_side_data=rotation',
    '-of',
    'json',
    inputPath,
  ], { timeoutMs: limits.probeTimeoutMs })

  let output: ProbeOutput
  try {
    output = JSON.parse(stdout) as ProbeOutput
  } catch {
    throw new Error('ffprobe returned invalid metadata')
  }
  return validateProbeOutput(output, limits, inputPath)
}

export async function generatedDirectoryUsage(directory: string): Promise<number> {
  let total = 0
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0
    throw error
  }
  for (const entry of entries) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) total += await generatedDirectoryUsage(target)
    else if (entry.isFile()) total += (await stat(target)).size
  }
  return total
}

export function assertGeneratedStorageAvailable(
  usedBytes: number,
  reservedBytes: number,
  quotaBytes: number,
) {
  if (usedBytes + reservedBytes > quotaBytes) {
    throw new Error('Generated media storage quota would be exceeded')
  }
}

export function buildTranscodeArgs({
  inputPath,
  outputPath,
  hasAudio,
  limits,
}: {
  inputPath: string
  outputPath: string
  hasAudio: boolean
  limits: VideoProcessingLimits
}) {
  const scale = "scale=w='if(gte(iw,ih),min(1920,trunc(iw/2)*2),-2)':h='if(gte(iw,ih),-2,min(1920,trunc(ih/2)*2))'"
  const args = [
    '-nostdin',
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-protocol_whitelist',
    'file',
    '-i',
    inputPath,
    '-map',
    '0:v:0',
    '-vf',
    scale,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
  ]
  if (hasAudio) args.push('-map', '0:a:0', '-c:a', 'aac', '-b:a', '192k')
  else args.push('-an')
  args.push(
    '-threads', String(limits.threads),
    '-t', String(limits.maxDurationSeconds),
    '-fs', String(limits.maxOutputBytes),
    outputPath,
  )
  return args
}

const cleanup = async (paths: string[]) => {
  const failures: Error[] = []
  for (const target of paths) {
    try {
      await rm(target, { recursive: true, force: true })
    } catch (error) {
      failures.push(error instanceof Error ? error : new Error(String(error)))
    }
  }
  return failures
}

export async function processVideo({
  inputPath,
  mediaId,
  revision,
  mediaRoot = path.dirname(GENERATED_MEDIA_ROOT),
  limits = getVideoProcessingLimits(),
}: ProcessVideoOptions): Promise<ProcessedVideo> {
  const inputStats = await stat(inputPath)
  assertFileSizeWithinLimit(inputStats.size, limits.maxInputBytes, 'Input video')
  const playbackFilename = derivativeRelativePath(mediaId, revision, 'playback')
  const posterFilename = derivativeRelativePath(mediaId, revision, 'poster')
  const playbackPath = resolveContainedMediaPath(playbackFilename, mediaRoot)
  const posterPath = resolveContainedMediaPath(posterFilename, mediaRoot)
  const revisionDir = path.dirname(playbackPath)
  const generatedRoot = resolveContainedMediaPath('generated', mediaRoot)
  assertGeneratedStorageAvailable(
    await generatedDirectoryUsage(generatedRoot),
    limits.maxOutputBytes + 32 * MIB,
    limits.maxGeneratedBytes,
  )
  const inputProbe = await probeVideo(inputPath, limits)
  const temporaryDir = path.join(generatedRoot, '.tmp', `${mediaId}-r${revision}-${randomUUID()}`)
  const temporaryPlayback = path.join(temporaryDir, 'playback.tmp.mp4')
  const temporaryPoster = path.join(temporaryDir, 'poster.tmp.jpg')
  const publishedFiles: string[] = []
  let createdRevisionDir = false
  let processingError: unknown

  try {
    await mkdir(temporaryDir, { recursive: true })
    await mkdir(path.dirname(revisionDir), { recursive: true })
    await mkdir(revisionDir)
    createdRevisionDir = true

    const transcodeArgs = buildTranscodeArgs({
      inputPath,
      outputPath: temporaryPlayback,
      hasAudio: inputProbe.hasAudio,
      limits,
    })

    await runProcess(executable('ffmpeg'), transcodeArgs, {
      timeoutMs: limits.transcodeTimeoutMs,
    })
    const transcodedStats = await stat(temporaryPlayback)
    assertFileSizeWithinLimit(
      transcodedStats.size,
      limits.maxOutputBytes,
      'Generated playback',
    )

    const seekSeconds = Math.max(
      0,
      Math.min(inputProbe.duration * 0.25, inputProbe.duration - 0.01),
    )
    await runProcess(executable('ffmpeg'), [
      '-nostdin',
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-protocol_whitelist',
      'file',
      '-ss',
      seekSeconds.toFixed(3),
      '-i',
      temporaryPlayback,
      '-frames:v',
      '1',
      '-q:v',
      '2',
      '-threads',
      String(limits.threads),
      temporaryPoster,
    ], { timeoutMs: limits.posterTimeoutMs })

    const [outputProbe, posterMetadata, posterStats] = await Promise.all([
      probeVideo(temporaryPlayback, limits),
      sharp(temporaryPoster, {
        failOn: 'warning',
        limitInputPixels: limits.maxPixels,
      }).metadata(),
      stat(temporaryPoster),
    ])
    assertFileSizeWithinLimit(posterStats.size, 32 * MIB, 'Generated poster')

    if (
      !posterMetadata.width ||
      !posterMetadata.height ||
      outputProbe.width % 2 !== 0 ||
      outputProbe.height % 2 !== 0
    ) {
      throw new Error('Generated media dimensions are invalid')
    }

    await link(temporaryPlayback, playbackPath)
    publishedFiles.push(playbackPath)
    await link(temporaryPoster, posterPath)
    publishedFiles.push(posterPath)

    return {
      ...outputProbe,
      playbackFilename,
      playbackMimeType: 'video/mp4',
      playbackFilesize: transcodedStats.size,
      posterFilename,
      posterMimeType: 'image/jpeg',
      posterWidth: posterMetadata.width,
      posterHeight: posterMetadata.height,
      transitionColor: await deriveTransitionColor(posterPath),
    }
  } catch (error) {
    processingError = error
    const cleanupFailures = await cleanup([
      ...publishedFiles,
      ...(createdRevisionDir ? [revisionDir] : []),
    ])
    if (cleanupFailures.length) {
      throw new AggregateError(
        [error, ...cleanupFailures],
        'Video processing and generated-file cleanup failed',
      )
    }
    throw error
  } finally {
    const cleanupFailures = await cleanup([temporaryDir])
    try {
      await rmdir(path.dirname(temporaryDir))
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT' && code !== 'ENOTEMPTY') {
        cleanupFailures.push(error instanceof Error ? error : new Error(String(error)))
      }
    }
    if (cleanupFailures.length) {
      if (!processingError) {
        cleanupFailures.push(...await cleanup([
          ...publishedFiles,
          ...(createdRevisionDir ? [revisionDir] : []),
        ]))
      }
      throw new AggregateError(
        [...(processingError ? [processingError] : []), ...cleanupFailures],
        'Temporary video cleanup failed',
      )
    }
  }
}
