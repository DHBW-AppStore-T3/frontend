import type { Theme } from './types'
import { setActiveTheme } from './useTheme'

export function applyTheme(
  theme: Theme,
  root: HTMLElement = document.documentElement,
  doc: Document = document,
): void {
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--color-${key}`, value)
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
