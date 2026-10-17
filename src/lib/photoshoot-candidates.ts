import { inferMediaKind, isUsableMedia, mediaPresentationUrl, type MediaLike } from './media'

// These mirror photoshoot-gallery in styles.css, not intrinsic media ratios.
// Browser characterization: inline-block baseline descent adds 3px after each
// figure in Chrome 155 (older Chromium adds ~4px). Subpixel rounding is immaterial
// to scoring, but the extra line-box space matters to column breaks and clipping.
const ratios = [3 / 4, 4 / 5, 1, 2 / 3, 5 / 4, 3 / 5, 4 / 3]
const widths = [390, 700, 701, 900, 1100, 1101, 1440, 1920]
const heights = [600, 844, 900, 1000, 1080]
const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value))

function positions(count: number, width: number) {
  const columns = width <= 1100 ? 2 : 3
  const padding = width <= 700 ? 0 : clamp(18, width * .028, 46)
  const gap = width <= 700 ? 8 : clamp(12, width * .015, 24)
  const columnWidth = (width - padding * 2 - gap * (columns - 1)) / columns
  const cardHeights = Array.from({ length: count }, (_, index) => columnWidth / ratios[index % 7])
  const extents = cardHeights.map((height) => height + gap + 3)
  const columnCount = (limit: number) => {
    let used = 1
    let current = 0
    for (const extent of extents) {
      if (current + extent > limit) { used += 1; current = 0 }
      current += extent
    }
    return used
  }
  let low = Math.max(0, ...extents)
  let high = extents.reduce((sum, extent) => sum + extent, 0)
  while (high - low > .001) {
    const mid = (low + high) / 2
    if (columnCount(mid) <= columns) high = mid
    else low = mid
  }
  let top = 0
  return cardHeights.map((height, index) => {
    if (top + extents[index] > high) top = 0
    const result = { top, height, width: columnWidth }
    top += extents[index]
    return result
  })
}

/** One content-derived SSR identity set. No viewport state or hydration expansion.
 * Greedy marginal coverage chooses the best clipped area across responsive/title
 * scenarios, then allocates the FOUR-identity budget globally, not per breakpoint.
 */
export function selectPhotoshootCandidates(media: readonly MediaLike[]): ReadonlySet<string> {
  const identities = media.map((item) =>
    inferMediaKind(item) === 'image' && isUsableMedia(item) ? mediaPresentationUrl(item) : null)
  const unique = [...new Set(identities.filter((url): url is string => Boolean(url)))]
  const scenarios: Map<string, number>[] = []
  for (const width of widths) {
    const cards = positions(media.length, width)
    const headPadding = width <= 700 ? clamp(110, width * .26, 150) : clamp(130, width * .12, 200)
    const fontSize = width <= 700 ? clamp(70, width * .21, 116) : clamp(80, width * .11, 188)
    for (const height of heights) {
      for (let lines = 1; lines <= 4; lines += 1) {
        // Header normal-flow height cancels its negative bottom margin.
        const galleryTop = headPadding + fontSize * .76 * lines + 40
        const areas = new Map<string, number>()
        cards.forEach((card, index) => {
          const identity = identities[index]
          if (!identity) return
          const visible = Math.max(0, Math.min(card.height, height - galleryTop - card.top))
          areas.set(identity, Math.max(areas.get(identity) || 0, card.width * visible))
        })
        const largest = Math.max(0, ...areas.values())
        if (largest > 0) scenarios.push(new Map([...areas].map(([url, area]) => [url, area / largest])))
      }
    }
  }

  const selected = new Set<string>()
  const covered = scenarios.map(() => 0)
  while (selected.size < 4) {
    let best: string | null = null
    let bestGain = 0
    let bestWins = 0
    for (const identity of unique) {
      if (selected.has(identity)) continue
      let gain = 0
      let wins = 0
      scenarios.forEach((scenario, index) => {
        const score = scenario.get(identity) || 0
        gain += Math.max(0, score - covered[index])
        if (score === 1) wins += 1
      })
      // Stable source order resolves remaining ties. Floating-point noise is
      // not a meaningful geometric difference.
      if (gain > bestGain + 1e-9 || (gain > 1e-9 && Math.abs(gain - bestGain) <= 1e-9 && wins > bestWins)) {
        best = identity; bestGain = gain; bestWins = wins
      }
    }
    if (!best) break
    selected.add(best)
    scenarios.forEach((scenario, index) => { covered[index] = Math.max(covered[index], scenario.get(best!) || 0) })
  }
  return selected
}
