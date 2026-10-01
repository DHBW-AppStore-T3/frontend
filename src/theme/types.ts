export type Rgb = `${number} ${number} ${number}`

export const THEME_COLOR_KEYS = [
  'primary', 'primary-dark', 'primary-light', 'primary-deep', 'primary-darkest',
  'primary-soft', 'primary-faint', 'primary-action', 'primary-action-hover',
  'brand-accent', 'brand-accent-soft', 'brand-indicator',
  'bg-soft', 'surface-tint', 'surface-page', 'surface-dark',
  'surface-muted', 'border-subtle', 'text-strong', 'text-heading', 'text-muted', 'text-faint',
  'auth-accent', 'auth-muted', 'auth-surface', 'auth-heading', 'auth-fold',
  'auth-language-border', 'auth-language-text', 'auth-language-selected',
  'auth-language-hover', 'auth-divider', 'auth-feature-icon',
  'auth-connector-border', 'auth-card-border', 'auth-card-surface',
  'auth-card-text', 'auth-card-shadow', 'auth-connector-line',
  'auth-status-ring', 'auth-mobile-fold', 'auth-accent-hover',
  'workspace-shadow', 'workspace-fold',
  'primary-hover', 'primary-active', 'primary-subtle',
  'background', 'surface', 'surface-elevated',
  'text-primary', 'text-secondary', 'text-on-primary',
  'border', 'border-strong', 'focus',
  'success', 'success-hover', 'success-tint', 'warning', 'warning-tint',
  'error', 'danger', 'danger-tint', 'info', 'info-tint',
  'destructive', 'destructive-soft', 'on-dark',
  'status-green', 'status-yellow', 'status-orange', 'status-slate',
] as const

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number]

/** Optional presentation tokens; shared CSS supplies the default appearance. */
export const THEME_STYLE_KEYS = ['dashboard-scrim', 'dashboard-position'] as const

export interface Theme {
  id: string
  brand: { name: string; tagline: string; documentTitle: string; institution?: string }
  logo: { src: string; alt: string; height: number; offsetX: number; offsetY: number }
  /** Optional logo for light surfaces; falls back to the main logo. */
  authLogo?: { src: string; alt: string; height: number }
  /** Decorative image shared by login and dashboard. */
  loginBackground?: string
  favicon: string
  colors: Record<ThemeColorKey, Rgb>
  styles?: Partial<Record<(typeof THEME_STYLE_KEYS)[number], string>>
}
