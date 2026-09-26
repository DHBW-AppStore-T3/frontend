import type { Theme } from '../types'
import logo from '../assets/six7-white.png'

export const defaultTheme: Theme = {
  id: 'default',
  brand: { name: 'SIX7', tagline: "Click'n Deploy", documentTitle: "Six7 Click'n'Deploy" },
  logo: { src: logo, alt: "SIX7 Click'n Deploy", height: 96, offsetX: -8, offsetY: -24 },
  favicon: '/logo.png',
  colors: {
    'primary': '49 113 83',
    'primary-dark': '51 106 74',
    'primary-light': '78 125 103',
    'primary-deep': '30 74 50',
    'primary-darkest': '23 51 37',
    'primary-soft': '185 212 192',
    'primary-faint': '219 229 222',
    'primary-action': '46 92 70',
    'primary-action-hover': '35 74 54',
    'brand-accent': '228 140 42',
    'brand-indicator': '228 140 42',
    'brand-accent-soft': '251 230 207',
    'bg-soft': '244 247 245',
    'surface-tint': '239 245 242',
    'surface-page': '248 250 249',
    'surface-dark': '30 45 38',
  },
}
