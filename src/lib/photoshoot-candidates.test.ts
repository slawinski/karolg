import { describe, expect, it } from 'vitest'
import { selectPhotoshootCandidates } from './photoshoot-candidates'
import { controlledMedia, controlledVideo, regressionMedia } from '@/test/fixtures/photoshoot-candidates'

describe('photoshoot candidate identities', () => {
  it('derives the later taller mobile candidate from geometry, independently of filenames', () => {
    const media = regressionMedia.map((item, index) => ({ ...item, url: `/renamed/${index}.jpg` }))
    const selected = selectPhotoshootCandidates(media)
    expect(selected.has('/renamed/5.jpg')).toBe(true)
    expect(selected.size).toBeLessThanOrEqual(4)
    expect(selected.size).toBeGreaterThan(1)
    expect(selectPhotoshootCandidates(media)).toEqual(selected)
  })

  it('counts repeated presentation URLs once without mutating full gallery slots', () => {
    const media = controlledMedia(14)
    media[5] = { ...media[5], url: media[0].url }
    const before = structuredClone(media)
    const selected = selectPhotoshootCandidates(media)
    expect(selected.size).toBeLessThanOrEqual(4)
    expect(media).toEqual(before)
    expect([...selected].every((url) => media.some((item) => item.url === url))).toBe(true)
  })

  it('keeps videos in the ratio cycle without spending still slots on them or unusable placeholders', () => {
    const media = controlledMedia(9)
    media[0] = controlledVideo
    media[3] = { ...controlledVideo, id: 'second-video' }
    media[6] = { kind: 'image' }
    const selected = selectPhotoshootCandidates(media)
    expect(selected.size).toBeLessThanOrEqual(4)
    expect(selected.has(controlledVideo.playbackUrl!)).toBe(false)
    expect([...selected].every((url) => media.some((item) => item.kind === 'image' && item.url === url))).toBe(true)
    expect(selected).not.toEqual(selectPhotoshootCandidates(media.filter((item) => item.kind === 'image')))
  })

  it('does not exhaust the budget arbitrarily for empty, video-only or short input', () => {
    expect(selectPhotoshootCandidates([]).size).toBe(0)
    expect(selectPhotoshootCandidates([controlledVideo]).size).toBe(0)
    expect([...selectPhotoshootCandidates(controlledMedia(1))]).toEqual(['/__controlled__/still-0.jpg'])
    expect(selectPhotoshootCandidates(controlledMedia(2)).size).toBeLessThanOrEqual(2)
  })
})
