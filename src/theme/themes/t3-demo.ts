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
    'primary': '143 48 58',
    'primary-dark': '128 42 52',
    'primary-light': '176 96 104',
    'primary-deep': '96 32 42',
    'primary-darkest': '48 26 32',
    'primary-soft': '236 220 222',
    'primary-faint': '246 238 239',
    'primary-action': '128 42 52',
    'primary-action-hover': '104 34 44',
    'brand-accent': '143 48 58',
    'brand-indicator': '255 255 255',
    'brand-accent-soft': '246 233 235',
    'bg-soft': '249 246 246',
    'surface-tint': '250 241 242',
    'surface-page': '251 249 249',
    'surface-dark': '38 36 40',
  },
}
