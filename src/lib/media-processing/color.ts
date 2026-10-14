import sharp from 'sharp'

export const TRANSITION_COLOR_BACKGROUND = '#b8afa5'

const srgbToLinear = (value: number) => {
  const channel = value / 255
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4
}

const linearToSrgb = (value: number) => {
  const channel =
    value <= 0.0031308
      ? value * 12.92
      : 1.055 * value ** (1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, channel)) * 255)
}

const asHex = (value: number) => value.toString(16).padStart(2, '0')

export async function deriveTransitionColor(
  input: Buffer | string,
): Promise<string | null> {
  try {
    const { data, info } = await sharp(input, {
      failOn: 'warning',
      limitInputPixels: 100_000_000,
      limitInputChannels: 4,
    })
      .rotate()
      .flatten({ background: TRANSITION_COLOR_BACKGROUND })
      .resize({
        width: 32,
        height: 32,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toColourspace('srgb')
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    if (!data.length || info.channels < 3) return null

    const totals = [0, 0, 0]
    const pixels = data.length / info.channels

    for (let offset = 0; offset < data.length; offset += info.channels) {
      totals[0] += srgbToLinear(data[offset])
      totals[1] += srgbToLinear(data[offset + 1])
      totals[2] += srgbToLinear(data[offset + 2])
    }

    const [red, green, blue] = totals.map((total) => linearToSrgb(total / pixels))
    return `#${asHex(red)}${asHex(green)}${asHex(blue)}`
  } catch {
    return null
  }
}
