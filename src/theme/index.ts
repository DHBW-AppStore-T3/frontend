import type { Theme } from './types'
import { defaultTheme } from './themes/default'
import { t3Theme } from './themes/t3'

export const THEMES: Record<string, Theme> = {
  [defaultTheme.id]: defaultTheme,
  [t3Theme.id]: t3Theme,
}

// Kept for existing `VITE_THEME=t3-demo` deployments: resolves to `t3`, never a random
// unknown-fallback. New docs/config use `t3` only.
export const LEGACY_THEME_ALIASES: Record<string, string> = {
  't3-demo': 't3',
}

export function resolveTheme(id: string | undefined): Theme {
  const resolvedId = id ? (LEGACY_THEME_ALIASES[id] ?? id) : undefined
  const theme = resolvedId ? THEMES[resolvedId] : undefined
  if (theme) return theme
  console.warn(`Unknown theme "${id ?? ''}", falling back to "t3"`)
  return t3Theme
}
