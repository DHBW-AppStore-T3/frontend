export interface ContrastPair {
  name: string
  fg: string
  bg: string
  usage: 'text' | 'non-text'
}

function luminance(rgb: string): number {
  const [r, g, b] = rgb.split(' ').map((c) => {
    const s = Number(c) / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(fgRgb: string, bgRgb: string): number {
  const [hi, lo] = [luminance(fgRgb), luminance(bgRgb)].sort((a, b) => b - a) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}
