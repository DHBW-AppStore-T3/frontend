import type { Theme } from '../types'
import logo from '../assets/t3-white.png'
import authLogo from '../assets/t3-red.png'

// Demo theme to showcase white-labeling. NOT an official DHBW corporate design.
export const t3DemoTheme: Theme = {
  id: 't3-demo',
  brand: { name: 'T3', tagline: 'AppStore', documentTitle: 'T3 AppStore' },
  logo: { src: logo, alt: 'T3 AppStore', height: 36, offsetX: 0, offsetY: 6 },
  authLogo: { src: authLogo, alt: 'T3 AppStore', height: 72 },
  favicon: '/themes/t3-demo/favicon.png',
  colors: {
    'primary': '158 42 54',
    'primary-dark': '142 38 49',
    'primary-light': '186 92 100',
    'primary-deep': '100 30 40',
    'primary-darkest': '50 24 30',
    'primary-soft': '238 220 222',
    'primary-faint': '247 237 238',
    'primary-action': '142 38 49',
    'primary-action-hover': '112 30 40',
    'brand-accent': '158 42 54',
    'brand-indicator': '255 255 255',
    'brand-accent-soft': '248 232 234',
    'bg-soft': '250 246 246',
    'surface-tint': '253 240 241',
    'surface-page': '252 249 249',
    'surface-dark': '36 36 40',
  },
}
