import { describe, it, expect, vi } from 'vitest'
import { THEMES, resolveTheme } from '@/theme'
import { THEME_COLOR_KEYS } from '@/theme/types'

describe('themes', () => {
  it.each(Object.entries(THEMES))('%s defines exactly THEME_COLOR_KEYS with valid RGB triples', (_id, theme) => {
    expect(Object.keys(theme.colors).sort()).toEqual([...THEME_COLOR_KEYS].sort())
    for (const [key, value] of Object.entries(theme.colors)) {
      expect(value, key).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/)
      for (const ch of value.split(' ')) expect(Number(ch), key).toBeLessThanOrEqual(255)
    }
  })

  it('has unique theme ids matching their registry key', () => {
    const ids = Object.values(THEMES).map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const [key, theme] of Object.entries(THEMES)) expect(theme.id).toBe(key)
  })

  it('resolves known ids', () => {
    expect(resolveTheme('t3-demo').id).toBe('t3-demo')
    expect(resolveTheme('default').id).toBe('default')
  })

  it('falls back to default with a warning for unknown or empty ids', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveTheme('gibts-nicht').id).toBe('default')
    expect(resolveTheme('').id).toBe('default')
    expect(resolveTheme(undefined).id).toBe('default')
    expect(warn).toHaveBeenCalledTimes(3)
    warn.mockRestore()
  })
})
