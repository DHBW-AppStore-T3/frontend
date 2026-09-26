import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { THEME_COLOR_KEYS } from '@/theme/types'
// @ts-expect-error -- plain JS config without type declarations
import tailwindConfig from '../../../tailwind.config.js'

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

describe('branding', () => {
  it('keeps SIX7/Six7 strings and Six7 assets inside src/theme/', () => {
    const THEME_DIR = path.join(SRC, 'theme')
    const offenders: string[] = []
    const files = [...walk(SRC), path.join(ROOT, 'index.html')]
    for (const file of files) {
      if (file.startsWith(THEME_DIR + path.sep)) continue
      fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (/SIX7|Six7/.test(line) && !/github\.com/i.test(line)) {
          offenders.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim()}`)
        }
      })
    }
    expect(offenders).toEqual([])
  })
})

describe('layout and base UI', () => {
  it('use brand tokens instead of green/emerald/teal palette classes', () => {
    const files = [
      ...fs.readdirSync(path.join(SRC, 'layouts')).map((f) => path.join(SRC, 'layouts', f)),
      ...['BaseButton', 'BaseInput', 'Card', 'Modal', 'PageHeader'].map((n) =>
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
    const skip = ['styles/colors.css', '__snapshots__', '__tests__', 'types'].map((p) =>
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
