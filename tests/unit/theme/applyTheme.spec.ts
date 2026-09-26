import { describe, it, expect, beforeEach } from 'vitest'
import { applyTheme } from '@/theme/applyTheme'
import { useTheme } from '@/theme/useTheme'
import { THEMES } from '@/theme'
import { THEME_COLOR_KEYS } from '@/theme/types'

describe('applyTheme', () => {
  beforeEach(() => {
    document.head.querySelectorAll('link[rel="icon"]').forEach((l) => l.remove())
    document.documentElement.removeAttribute('style')
  })

  it('writes every color as --color-* on the root', () => {
    applyTheme(THEMES['default']!)
    for (const key of THEME_COLOR_KEYS) {
      expect(document.documentElement.style.getPropertyValue(`--color-${key}`)).toBe(
        THEMES['default']!.colors[key],
      )
    }
  })

  it('sets document title and creates the favicon link when missing', () => {
    applyTheme(THEMES['t3-demo']!)
    expect(document.title).toBe(THEMES['t3-demo']!.brand.documentTitle)
    const link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('href')).toBe(THEMES['t3-demo']!.favicon)
  })

  it('a second call overrides everything and reuses the link', () => {
    applyTheme(THEMES['default']!)
    applyTheme(THEMES['t3-demo']!)
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe(
      THEMES['t3-demo']!.colors.primary,
    )
    expect(document.title).toBe(THEMES['t3-demo']!.brand.documentTitle)
    expect(document.head.querySelectorAll('link[rel="icon"]')).toHaveLength(1)
  })

  it('useTheme returns the last applied theme', () => {
    applyTheme(THEMES['t3-demo']!)
    expect(useTheme().id).toBe('t3-demo')
    applyTheme(THEMES['default']!)
    expect(useTheme().id).toBe('default')
  })
})
