import { describe, it, expect, vi } from 'vitest'
import { THEMES, resolveTheme } from '@/theme'
import { THEME_COLOR_KEYS } from '@/theme/types'

describe('themes', () => {
  it.each(Object.entries(THEMES))('%s fulfills the theme contract', (id, theme) => {
    expect(theme.id).toBe(id)
    expect(theme.brand.name).toBeTruthy()
    expect(theme.brand.documentTitle).toBeTruthy()
    expect(theme.logo.src).toBeTruthy()
    expect(theme.logo.alt).toBeTruthy()
    expect(theme.favicon).toBeTruthy()
    expect(Object.keys(theme.colors).sort()).toEqual([...THEME_COLOR_KEYS].sort())
    for (const [key, value] of Object.entries(theme.colors)) {
      expect(value, key).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/)
      for (const channel of value.split(' ')) expect(Number(channel), key).toBeLessThanOrEqual(255)
    }
  })

  it('uses T3 by default and for an explicit T3 selection', () => {
    expect(resolveTheme(undefined)).toBe(THEMES.t3)
    expect(resolveTheme('')).toBe(THEMES.t3)
    expect(resolveTheme('t3')).toBe(THEMES.t3)
  })

  it('warns and falls back to T3 for unknown IDs without registering aliases', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const oldId of ['six' + '7', 't3-' + 'demo', 'default', 'unknown']) {
      expect(THEMES).not.toHaveProperty(oldId)
      expect(resolveTheme(oldId)).toBe(THEMES.t3)
    }
    expect(warn).toHaveBeenCalledTimes(4)
    warn.mockRestore()
  })
})
