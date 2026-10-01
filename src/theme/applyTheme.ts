import type { Theme } from './types'
import { THEME_STYLE_KEYS } from './types'
import { setActiveTheme } from './useTheme'

export function applyTheme(
  theme: Theme,
  root: HTMLElement = document.documentElement,
  doc: Document = document,
): void {
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--color-${key}`, value)
  }
  for (const key of THEME_STYLE_KEYS) {
    const value = theme.styles?.[key]
    if (value) root.style.setProperty(`--theme-${key}`, value)
    else root.style.removeProperty(`--theme-${key}`)
  }
  doc.title = theme.brand.documentTitle

  let link = doc.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = doc.createElement('link')
    link.rel = 'icon'
    doc.head.appendChild(link)
  }
  link.href = theme.favicon
  setActiveTheme(theme)
}
