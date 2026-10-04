import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { THEME_COLOR_KEYS } from '@/theme/types'
import { t3Theme } from '@/theme/themes/t3'
// @ts-expect-error -- plain JS config without type declarations
import tailwindConfig from '../../../tailwind.config.js'
import { contrastRatio, type ContrastPair } from './contrast.helper'

const ROOT = path.resolve(__dirname, '../../..')
const SRC = path.join(ROOT, 'src')
const COLORS_CSS = path.join(SRC, 'styles', 'colors.css')

const themeColors = (tailwindConfig as { theme: { extend: { colors: Record<string, string> } } }).theme.extend.colors as Record<string, string>

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.(vue|ts|css)$/.test(entry.name)) out.push(full)
  }
  return out
}

describe('tailwind colors', () => {
  it('maps every theme color to rgb(var(--color-…) / <alpha-value>)', () => {
    const entries = Object.entries(themeColors)
    expect(entries.length).toBeGreaterThan(0)
    for (const [name, value] of entries) {
      expect(value, name).toMatch(/^rgb\(var\(--color-[a-z-]+\) \/ <alpha-value>\)$/)
    }
  })

  it('does not override Tailwind default colors', () => {
    const forbidden = [
      'white', 'black', 'transparent', 'current', 'inherit',
      'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber',
      'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue',
      'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
    ]
    for (const key of forbidden) expect(themeColors).not.toHaveProperty(key)
  })
})

describe('colors.css', () => {
  const css = fs.readFileSync(COLORS_CSS, 'utf8')
  const defined = new Map<string, number>()
  for (const m of css.matchAll(/(--color-[a-z-]+):\s*(\d+ \d+ \d+);/g)) {
    defined.set(m[1]!, (defined.get(m[1]!) ?? 0) + 1)
  }
  const themeKeys = new Set(THEME_COLOR_KEYS.map((k) => `--color-${k}`))

  it('defines a channel triple for every referenced variable unless the theme provides it', () => {
    const referenced = new Set<string>()
    const sources = [
      ...walk(SRC).filter((f) => f !== COLORS_CSS),
      path.join(ROOT, 'tailwind.config.js'),
    ]
    for (const file of sources) {
      const text = fs.readFileSync(file, 'utf8')
      for (const m of text.matchAll(/var\((--color-[a-z-]+)\)/g)) referenced.add(m[1]!)
    }
    for (const value of Object.values(themeColors)) {
      referenced.add(value.match(/var\((--color-[a-z-]+)\)/)![1]!)
    }
    for (const name of referenced) {
      expect(defined.has(name) || themeKeys.has(name), name).toBe(true)
    }
  })

  it('does not define any theme-provided brand key', () => {
    for (const key of themeKeys) expect(defined.has(key), key).toBe(false)
  })

  it('defines no variable twice', () => {
    for (const [name, count] of defined) expect(count, name).toBe(1)
  })
})

describe('legacy tokens', () => {
  it('no longer appear in source', () => {
    const legacy = /accentYellow|lightYellow|buttonGreen|lightGreen|ultraLightGreen|accentRed|lightRed|--color-(accent-yellow|light-yellow|button-green|light-green|ultra-light-green|accent-red|light-red)/
    const offenders: string[] = []
    for (const file of [...walk(SRC), path.join(ROOT, 'tailwind.config.js')]) {
      if (legacy.test(fs.readFileSync(file, 'utf8'))) offenders.push(path.relative(ROOT, file))
    }
    expect(offenders).toEqual([])
  })
})

describe('semantic color usage meets WCAG contrast per context', () => {
  const white = '255 255 255'

  function colorVar(name: string): string {
    return t3Theme.colors[name as keyof typeof t3Theme.colors]
  }

  // Real foreground/background combinations used by Badge.vue (text on tint) and
  // Toast.vue (icon on white) — not every base color checked against white in isolation.
  const pairs: ContrastPair[] = [
    { name: 'Badge success text on success-tint', fg: colorVar('success'), bg: colorVar('success-tint'), usage: 'text' },
    { name: 'Badge danger text on danger-tint', fg: colorVar('danger'), bg: colorVar('danger-tint'), usage: 'text' },
    { name: 'Badge warning text on warning-tint', fg: colorVar('warning'), bg: colorVar('warning-tint'), usage: 'text' },
    { name: 'Badge info text on info-tint', fg: colorVar('info'), bg: colorVar('info-tint'), usage: 'text' },
    { name: 'Toast success icon on white', fg: colorVar('success'), bg: white, usage: 'non-text' },
    { name: 'Toast danger icon on white', fg: colorVar('danger'), bg: white, usage: 'non-text' },
    { name: 'Toast warning icon on white', fg: colorVar('warning'), bg: white, usage: 'non-text' },
    { name: 'Toast info icon on white', fg: colorVar('info'), bg: white, usage: 'non-text' },
  ]

  for (const pair of pairs) {
    it(`${pair.name} (${pair.usage}) meets threshold`, () => {
      const threshold = pair.usage === 'text' ? 4.5 : 3
      expect(contrastRatio(pair.fg, pair.bg)).toBeGreaterThanOrEqual(threshold)
    })
  }
})

describe('tailwind design tokens', () => {
  const extend = (tailwindConfig as {
    theme: { extend: { borderRadius?: Record<string, string>; boxShadow?: Record<string, string>; spacing?: Record<string, string>; fontSize?: Record<string, unknown>; fontFamily?: Record<string, unknown> } }
  }).theme.extend

  it('binds borderRadius to --radius-* tokens', () => {
    expect(extend.borderRadius, 'borderRadius').toBeTruthy()
    for (const value of Object.values(extend.borderRadius!)) {
      expect(value).toMatch(/^var\(--radius-[a-z0-9]+\)$/)
    }
  })

  it('binds boxShadow to --shadow-* tokens', () => {
    expect(extend.boxShadow, 'boxShadow').toBeTruthy()
    for (const value of Object.values(extend.boxShadow!)) {
      expect(value).toMatch(/^var\(--shadow-[a-z0-9]+\)$/)
    }
  })

  it('binds spacing to --space-* tokens', () => {
    expect(extend.spacing, 'spacing').toBeTruthy()
    for (const value of Object.values(extend.spacing!)) {
      expect(value).toMatch(/^var\(--space-[0-9]+\)$/)
    }
  })

  it('binds fontFamily.sans to --font-family-sans', () => {
    expect(extend.fontFamily?.sans).toEqual(['var(--font-family-sans)'])
  })

  it('binds fontSize entries to --text-* tokens', () => {
    expect(extend.fontSize, 'fontSize').toBeTruthy()
    for (const value of Object.values(extend.fontSize!)) {
      expect(Array.isArray(value)).toBe(true)
      const [size] = value as [string, unknown]
      expect(size).toMatch(/^var\(--text-[a-z0-9-]+-size\)$/)
    }
  })
})

describe('layout and base UI', () => {
  it('use brand tokens instead of green/emerald/teal palette classes', () => {
    const files = [
      ...fs.readdirSync(path.join(SRC, 'layouts')).map((f) => path.join(SRC, 'layouts', f)),
      ...['BaseButton', 'BaseInput', 'Card', 'Modal', 'PageHeader', 'Badge', 'AppVersionStatusBadge'].map((n) =>
        path.join(SRC, 'components', 'ui', `${n}.vue`),
      ),
    ]
    const offenders = files.filter((f) =>
      /\b(bg|text|border|ring)-(green|emerald|teal)-/.test(fs.readFileSync(f, 'utf8')),
    )
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([])
  })
})

describe('source', () => {
  it('contains no hardcoded color literals', () => {
    const skip = ['styles/colors.css', 'styles/tokens.css', '__snapshots__', '__tests__', 'types'].map((p) =>
      path.join(SRC, p),
    )
    const offenders: string[] = []
    for (const file of walk(SRC)) {
      if (skip.some((s) => file === s || file.startsWith(s + path.sep))) continue
      fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (/#[0-9a-fA-F]{3,8}\b/.test(line) || /rgba?\(\s*(?!0\s*,\s*0\s*,\s*0\b)\d/.test(line)) {
          offenders.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim()}`)
        }
      })
    }
    expect(offenders).toEqual([])
  })
})
