import type { Theme } from '../types'
import logo from '../assets/t3-white.png'

// Demo theme to showcase white-labeling. NOT an official DHBW corporate design.
export const t3DemoTheme: Theme = {
  id: 't3-demo',
  brand: { name: 'T3', tagline: 'AppStore', documentTitle: 'T3 AppStore' },
  logo: { src: logo, alt: 'T3 AppStore', height: 96, offsetX: -8, offsetY: -24 },
  favicon: '/themes/t3-demo/favicon.png',
  colors: {
    'primary': '200 16 46',
    'primary-dark': '176 14 40',
    'primary-light': '222 60 78',
    'primary-deep': '139 10 26',
    'primary-darkest': '92 6 17',
    'primary-soft': '248 214 218',
    'primary-faint': '253 236 238',
    'primary-action': '176 14 40',
    'primary-action-hover': '139 10 26',
    'brand-accent': '200 16 46',
    'brand-accent-soft': '253 232 235',
    'bg-soft': '250 246 246',
    'surface-tint': '253 240 241',
    'surface-page': '252 249 249',
    'surface-dark': '45 20 24',
  },
}
