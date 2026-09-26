import type { Theme } from './types'
import { defaultTheme } from './themes/default'
import { t3DemoTheme } from './themes/t3-demo'

export const THEMES: Record<string, Theme> = {
  [defaultTheme.id]: defaultTheme,
  [t3DemoTheme.id]: t3DemoTheme,
}

export function resolveTheme(id: string | undefined): Theme {
  const theme = id ? THEMES[id] : undefined
  if (theme) return theme
  console.warn(`Unknown theme "${id ?? ''}", falling back to "default"`)
  return defaultTheme
}
