import type { Theme } from './types'
import { t3Theme } from './themes/t3'

export const THEMES: Record<string, Theme> = {
  [t3Theme.id]: t3Theme,
}

export function resolveTheme(id: string | undefined): Theme {
  if (!id) return t3Theme
  const theme = THEMES[id]
  if (theme) return theme
  console.warn(`Unknown theme "${id}", falling back to "t3"`)
  return t3Theme
}
