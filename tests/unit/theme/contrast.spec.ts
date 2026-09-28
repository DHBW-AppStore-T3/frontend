import { describe, it, expect } from 'vitest'
import { THEMES } from '@/theme'

function luminance(rgb: string): number {
  const [r, g, b] = rgb.split(' ').map((c) => {
    const s = Number(c) / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const ON_DARK = '255 255 255'

describe('theme contrast (WCAG AA)', () => {
  for (const [id, theme] of Object.entries(THEMES)) {
    for (const key of ['primary', 'primary-deep', 'primary-action'] as const) {
      it(`${id}: white on ${key} >= 4.5`, () => {
        expect(contrast(ON_DARK, theme.colors[key])).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})
