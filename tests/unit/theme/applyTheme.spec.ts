import { describe, it, expect, beforeEach } from 'vitest'
import { applyTheme } from '@/theme/applyTheme'
import { useTheme } from '@/theme/useTheme'
import { THEMES } from '@/theme'
import { THEME_COLOR_KEYS } from '@/theme/types'
import type { Theme } from '@/theme/types'

describe('applyTheme', () => {
  beforeEach(() => {
    document.head.querySelectorAll('link[rel="icon"]').forEach((l) => l.remove())
    document.documentElement.removeAttribute('style')
  })

  it('writes every color as --color-* on the root', () => {
    applyTheme(THEMES.t3!)
    for (const key of THEME_COLOR_KEYS) {
      expect(document.documentElement.style.getPropertyValue(`--color-${key}`)).toBe(
        THEMES.t3!.colors[key],
      )
    }
  })

  it('sets document title and creates the favicon link when missing', () => {
    applyTheme(THEMES['t3']!)
    expect(document.title).toBe(THEMES['t3']!.brand.documentTitle)
    const link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('href')).toBe(THEMES['t3']!.favicon)
  })

  it('a second call overrides everything and reuses the link', () => {
    const alternative: Theme = {
      ...THEMES.t3!,
      id: 'alternative',
      brand: { ...THEMES.t3!.brand, documentTitle: 'Alternative' },
      colors: { ...THEMES.t3!.colors, primary: '1 2 3' },
    }
    applyTheme(alternative)
    applyTheme(THEMES.t3!)
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe(
      THEMES['t3']!.colors.primary,
    )
    expect(document.title).toBe(THEMES['t3']!.brand.documentTitle)
    expect(document.head.querySelectorAll('link[rel="icon"]')).toHaveLength(1)
  })

  it('useTheme returns the last applied theme', () => {
    const alternative: Theme = { ...THEMES.t3!, id: 'alternative' }
    applyTheme(alternative)
    expect(useTheme().id).toBe('alternative')
    applyTheme(THEMES.t3!)
    expect(useTheme().id).toBe('t3')
  })

  it('clears Mannheim presentation overrides when returning to T3', () => {
    applyTheme(THEMES.mannheim!)
    expect(document.documentElement.style.getPropertyValue('--theme-dashboard-scrim')).toContain('linear-gradient')
    applyTheme(THEMES.t3!)
    expect(document.documentElement.style.getPropertyValue('--theme-dashboard-scrim')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--theme-dashboard-position')).toBe('')
  })
})
