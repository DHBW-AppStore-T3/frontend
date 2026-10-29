import { describe, it, expect } from 'vitest'
import de from '@/i18n/locales/de'
import en from '@/i18n/locales/en'

function paths(obj: unknown, prefix = ''): string[] {
  if (typeof obj === 'string') return [prefix]
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k))
  }
  return []
}
function leaves(obj: unknown): string[] {
  if (typeof obj === 'string') return [obj]
  if (obj && typeof obj === 'object') return Object.values(obj).flatMap(leaves)
  return []
}

describe('messages of the file variable card', () => {
  const fv = (l: any) => l.deployment.fileVariable

  it('exist in German and English with the same keys', () => {
    expect(paths(fv(de)).sort()).toEqual(paths(fv(en)).sort())
  })

  it('use the same placeholders in both languages', () => {
    const holders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    const flat = (l: any) => Object.fromEntries(paths(fv(l)).map((p) => [p, p.split('.').reduce((o: any, k) => o[k], fv(l)) as string]))
    const d = flat(de)
    const e = flat(en)
    for (const key of Object.keys(d)) expect(holders(e[key]!), key).toEqual(holders(d[key]!))
  })

  it('has singular and plural where a number is counted', () => {
    for (const l of [de, en]) {
      for (const key of ['audiencePeople', 'audienceTeams', 'morePeople', 'moreTeams', 'files']) {
        const bag = key === 'audiencePeople' || key === 'audienceTeams' ? fv(l) : key === 'files' ? fv(l).total : fv(l).recipients
        expect(typeof bag[`${key}_one`], key).toBe('string')
        expect(typeof bag[`${key}_other`], key).toBe('string')
      }
    }
  })

  it('use single-brace interpolation only', () => {
    for (const text of [...leaves(fv(de)), ...leaves(fv(en))]) {
      expect(text).not.toContain('{{')
      expect(text).not.toContain('}}')
    }
  })

  it('never shows a limit per file', () => {
    for (const text of [...leaves(fv(de)), ...leaves(fv(en))]) {
      expect(text).not.toMatch(/höchstens 1 MB|max\. ?\d+ MB|at most 1 MB/i)
    }
  })
})
