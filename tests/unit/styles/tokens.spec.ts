import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '../../..')
const SRC = path.join(ROOT, 'src')
const TOKENS_CSS = path.join(SRC, 'styles', 'tokens.css')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.vue$/.test(entry.name)) out.push(full)
  }
  return out
}

describe('tokens.css defines all required custom properties', () => {
  const css = fs.readFileSync(TOKENS_CSS, 'utf8')

  const required = [
    '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-2xl', '--radius-full',
    '--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-xl',
    '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6',
    '--space-7', '--space-8', '--space-9', '--space-10', '--space-11', '--space-12',
    '--font-family-sans',
    '--text-headline-1-size', '--text-headline-1-line-height',
    '--text-headline-2-size', '--text-headline-2-line-height',
    '--text-headline-3-size', '--text-headline-3-line-height',
    '--text-body-size', '--text-body-line-height',
    '--text-caption-size', '--text-caption-line-height',
    '--font-weight-bold', '--font-weight-semibold', '--font-weight-regular',
  ]

  for (const variable of required) {
    it(`defines ${variable}`, () => {
      const re = new RegExp(`${variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`)
      expect(re.test(css)).toBe(true)
    })
  }
})

describe('no arbitrary radius/shadow values in src', () => {
  it('has no Tailwind arbitrary-value radius/shadow classes or inline radius/shadow styles', () => {
    // Arbitrary radius is always disallowed. Arbitrary shadow is allowed only when it is a
    // dynamic, per-status glow built on an already-tokenized color (rgb(var(--color-…))) —
    // that's a color-status effect, not a magic value bypassing the radius/shadow scale.
    const arbitraryRadius = /\brounded-\[[^\]]+\]/
    const arbitraryShadow = /\bshadow-\[([^\]]+)\]/
    const inlineStyle = /style="[^"]*(border-radius|box-shadow)\s*:/
    const offenders: string[] = []
    for (const file of walk(SRC)) {
      const text = fs.readFileSync(file, 'utf8')
      text.split('\n').forEach((line, i) => {
        const shadowMatch = line.match(arbitraryShadow)
        const isTokenizedGlow = shadowMatch != null && /var\(--color-/.test(shadowMatch[1]!)
        if (
          arbitraryRadius.test(line) ||
          (shadowMatch != null && !isTokenizedGlow) ||
          inlineStyle.test(line)
        ) {
          offenders.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim()}`)
        }
      })
    }
    expect(offenders).toEqual([])
  })
})
