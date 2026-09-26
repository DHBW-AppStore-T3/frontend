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
    'primary': '178 42 56',
    'primary-dark': '160 38 50',
    'primary-light': '205 90 100',
    'primary-deep': '112 30 42',
    'primary-darkest': '52 24 30',
    'primary-soft': '242 218 221',
    'primary-faint': '250 236 238',
    'primary-action': '160 38 50',
    'primary-action-hover': '128 30 42',
    'brand-accent': '178 42 56',
    'brand-indicator': '255 255 255',
    'brand-accent-soft': '253 232 235',
    'bg-soft': '250 246 246',
    'surface-tint': '253 240 241',
    'surface-page': '252 249 249',
    'surface-dark': '36 36 40',
  },
}
