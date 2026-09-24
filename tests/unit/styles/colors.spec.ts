import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
// @ts-expect-error -- plain JS config without type declarations
import tailwindConfig from '../../../tailwind.config.js'

const ROOT = path.resolve(__dirname, '../../..')
const SRC = path.join(ROOT, 'src')
const COLORS_CSS = path.join(SRC, 'styles', 'colors.css')

const EXPECTED: Record<string, string> = {
  '--color-primary': '49 113 83',
  '--color-primary-dark': '51 106 74',
  '--color-primary-light': '78 125 103',
  '--color-light-green': '185 212 192',
  '--color-ultra-light-green': '219 229 222',
  '--color-accent-yellow': '228 140 42',
  '--color-light-yellow': '251 230 207',
  '--color-accent-red': '231 53 1',
  '--color-light-red': '248 214 204',
  '--color-bg-soft': '244 247 245',
  '--color-primary-deep': '30 74 50',
  '--color-primary-darkest': '23 51 37',
  '--color-button-green': '46 92 70',
  '--color-button-green-hover': '35 74 54',
  '--color-surface-tint': '239 245 242',
  '--color-surface-muted': '250 250 250',
  '--color-surface-page': '248 250 249',
  '--color-surface-dark': '30 45 38',
  '--color-border-subtle': '240 240 240',
  '--color-on-dark': '255 255 255',
  '--color-success': '16 185 129',
  '--color-danger': '239 68 68',
  '--color-warning': '245 158 11',
  '--color-info': '59 130 246',
  '--color-status-green': '34 197 94',
  '--color-status-yellow': '234 179 8',
  '--color-status-orange': '249 115 22',
  '--color-status-slate': '148 163 184',
  '--color-text-strong': '31 41 55',
  '--color-text-heading': '17 24 39',
  '--color-text-muted': '107 114 128',
  '--color-text-faint': '156 163 175',
}

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
  it('defines a channel triple for every referenced variable', () => {
    const css = fs.readFileSync(COLORS_CSS, 'utf8')
    const defined: Record<string, string> = {}
    for (const m of css.matchAll(/(--color-[a-z-]+):\s*(\d+ \d+ \d+);/g)) defined[m[1]!] = m[2]!

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

    for (const name of referenced) expect(defined, name).toHaveProperty(name)
    expect(defined).toEqual(EXPECTED)
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
