import type { Theme } from '../types'
import logo from '../assets/t3-white.png'
import authLogo from '../assets/t3-red.png'

// T3's real brand palette (Primary, Primary Hover, Secondary — see decisions doc for hex values).
export const t3Theme: Theme = {
  id: 't3',
  brand: { name: 'T3', tagline: 'AppStore', documentTitle: 'T3 AppStore' },
  logo: { src: logo, alt: 'T3 AppStore', height: 36, offsetX: 0, offsetY: 6 },
  authLogo: { src: authLogo, alt: 'T3 AppStore', height: 72 },
  favicon: '/themes/t3/favicon.png',
  colors: {
    'primary': '226 0 26',
    'primary-dark': '195 0 27',
    'primary-light': '240 127 140',
    'primary-deep': '150 0 21',
    'primary-darkest': '90 0 13',
    'primary-soft': '250 214 218',
    'primary-faint': '253 237 238',
    'primary-action': '226 0 26',
    'primary-action-hover': '195 0 27',
    'brand-accent': '104 114 96',
    'brand-accent-soft': '222 227 218',
    'brand-indicator': '255 255 255',
    'bg-soft': '250 247 247',
    'surface-tint': '251 240 241',
    'surface-page': '251 249 249',
    'surface-dark': '38 36 40',
  },
}
