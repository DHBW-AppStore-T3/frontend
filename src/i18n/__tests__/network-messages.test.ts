import { describe, it, expect } from 'vitest'
import de from '@/i18n/locales/de'
import en from '@/i18n/locales/en'

// The test i18n only hands back keys, and the app interpolates with single
// braces: read the locale objects directly.
function leaves(obj: unknown): string[] {
  if (typeof obj === 'string') return [obj]
  if (obj && typeof obj === 'object') return Object.values(obj).flatMap(leaves)
  return []
}

describe('network expert settings messages', () => {
  const dep = (l: any) => l.deployment.network

  it('exist in German and English with the same keys', () => {
    expect(Object.keys(dep(de)).sort()).toEqual(Object.keys(dep(en)).sort())
    expect(dep(de).internet.label).toBe('Internetzugriff')
    expect(dep(de).podNetwork.label).toBe('Vernetzte Pods')
    expect(dep(en).internet.label).toBe('Internet access')
    expect(dep(en).podNetwork.label).toBe('Networked pods')
  })

  it('use no double-brace interpolation', () => {
    for (const text of [...leaves(dep(de)), ...leaves(dep(en))]) {
      expect(text).not.toContain('{{')
      expect(text).not.toContain('}}')
    }
  })
})

describe('what pod networking promises', () => {
  const pods = (l: any) => l.deployment.network.podNetwork.help as string

  it('names the way to reach all peers, and that a broadcast is not delivered', () => {
    for (const text of [pods(de), pods(en)]) {
      expect(text).toContain('"peers"')
      expect(text).toContain('255.255.255.255')
      expect(text).toMatch(/TCP/)
      expect(text).toMatch(/UDP/)
    }
  })
})
