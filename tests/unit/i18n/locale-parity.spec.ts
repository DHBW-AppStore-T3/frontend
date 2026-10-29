import { describe, it, expect } from 'vitest'
import de from '@/i18n/locales/de'
import en from '@/i18n/locales/en'

// The English fallback is only loaded when it is the active language (#148), so
// German must not rely on it: every key exists in both files (plural suffixes
// aside, which differ per language).
const PLURAL = /_(zero|one|two|few|many|other)$/

function keys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix]
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
}

const base = (list: string[]) => new Set(list.map((k) => k.replace(PLURAL, '')))

describe('locale parity', () => {
  it('has the same keys in German and English', () => {
    const d = base(keys(de))
    const e = base(keys(en))
    expect([...d].filter((k) => !e.has(k))).toEqual([])
    expect([...e].filter((k) => !d.has(k))).toEqual([])
  })
})
