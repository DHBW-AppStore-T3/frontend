import type { Theme } from './types'
import { defaultTheme } from './themes/default'

let active: Theme = defaultTheme

export function setActiveTheme(theme: Theme): void {
  active = theme
}

// Set once at boot, before mount; never changes at runtime.
export function useTheme(): Theme {
  return active
}
