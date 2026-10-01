import type { Theme } from '../types'
import { t3Theme } from './t3'
import logo from '../assets/mannheim-logo.png'
import loginBackground from '../assets/mannheim-schloss.jpg'

export const mannheimTheme: Theme = {
  id: 'mannheim',
  brand: { name: 'Universität Mannheim', tagline: 'AppStore', documentTitle: 'Universität Mannheim AppStore' },
  logo: { src: logo, alt: 'Universität Mannheim', height: 36, offsetX: 0, offsetY: 6 },
  authLogo: { src: logo, alt: 'Universität Mannheim', height: 72 },
  loginBackground,
  favicon: '/themes/mannheim/favicon.png',
  colors: {
    ...t3Theme.colors,
    'primary': '0 47 86',
    'primary-dark': '0 40 74',
    'primary-light': '77 124 168',
    'primary-deep': '0 34 64',
    'primary-darkest': '0 20 38',
    'primary-soft': '214 226 239',
    'primary-faint': '235 241 247',
    'primary-action': '0 47 86',
    'primary-action-hover': '0 34 64',
    'primary-hover': '0 40 74',
    'primary-active': '0 34 64',
    'primary-subtle': '235 241 247',
    'focus': '0 95 163',
    'brand-accent': '90 100 112',
    'brand-accent-soft': '226 230 235',
    'surface-tint': '240 244 248',
    'auth-accent': '0 47 86',
    'auth-accent-hover': '0 34 64',
    'auth-language-selected': '214 226 239',
    'auth-language-hover': '232 238 245',
    'auth-status-ring': '77 124 168',
  },
}
