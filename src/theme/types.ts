export type Rgb = `${number} ${number} ${number}`

export const THEME_COLOR_KEYS = [
  'primary', 'primary-dark', 'primary-light', 'primary-deep', 'primary-darkest',
  'primary-soft', 'primary-faint', 'primary-action', 'primary-action-hover',
  'brand-accent', 'brand-accent-soft',
  'bg-soft', 'surface-tint', 'surface-page', 'surface-dark',
] as const

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number]

export interface Theme {
  id: string
  brand: { name: string; tagline: string; documentTitle: string }
  logo: { src: string; alt: string; height: number; offsetX: number; offsetY: number }
  favicon: string
  colors: Record<ThemeColorKey, Rgb>
}
