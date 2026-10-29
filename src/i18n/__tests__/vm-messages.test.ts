import { describe, it, expect } from 'vitest'
import de from '@/i18n/locales/de'
import en from '@/i18n/locales/en'

// The test i18n only hands back keys: read the locale objects directly.
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

describe('messages of the Windows VM variables step', () => {
  const vm = (l: any) => l.deployment.vm

  it('exist in German and English with the same keys', () => {
    expect(paths(vm(de)).sort()).toEqual(paths(vm(en)).sort())
  })

  it('name the machines desktops, never pods', () => {
    expect(vm(de).pods.label).toBe('Vernetzte Desktops')
    expect(vm(de).internet.label).toBe('Internetzugriff')
    expect(vm(en).pods.label).toBe('Networked desktops')
    for (const text of [...leaves(vm(de)), ...leaves(vm(en))]) {
      expect(text.toLowerCase()).not.toContain('pod')
    }
  })

  it('have a singular and a plural total', () => {
    for (const l of [de, en]) {
      expect(typeof vm(l).resources.totalLabel_one).toBe('string')
      expect(typeof vm(l).resources.totalLabel_other).toBe('string')
    }
  })

  it('use single-brace interpolation only', () => {
    for (const text of [...leaves(vm(de)), ...leaves(vm(en))]) {
      expect(text).not.toContain('{{')
      expect(text).not.toContain('}}')
    }
  })
})
