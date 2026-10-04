import type { Theme } from './types'
import { t3Theme } from './themes/t3'

let active: Theme = t3Theme

export function setActiveTheme(theme: Theme): void {
  active = theme
}

// Set once at boot, before mount; never changes at runtime.
export function useTheme(): Theme {
  return active
}
