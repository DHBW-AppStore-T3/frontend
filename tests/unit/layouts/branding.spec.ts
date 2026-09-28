import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { applyTheme } from '@/theme/applyTheme'
import { THEMES } from '@/theme'
import { t3Theme } from '@/theme/themes/t3'

function mountLayout(component: object) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/deployments', name: 'deployments.list', component: { template: '<div />' } },
    ],
  })
  const i18n = createI18n({ legacy: false, locale: 'de', missingWarn: false, fallbackWarn: false, messages: { de: {} } })
  return mount(component, {
    global: { plugins: [createPinia(), router, i18n] },
    slots: { default: '<p>content</p>' },
  })
}

describe('layout branding', () => {
  // The login page is a fixed T3 design by product decision — it no longer
  // follows the active white-label theme. AppLayout (the signed-in app shell)
  // still does.
  for (const [id, theme] of Object.entries(THEMES)) {
    it(`AuthLayout renders the fixed T3 brand regardless of active theme (${id})`, () => {
      applyTheme(theme)
      const html = mountLayout(AuthLayout).html()
      expect(html).toContain(t3Theme.authLogo!.src)
      expect(html).toContain(t3Theme.brand.tagline)
      expect(html).not.toContain('SIX7')
    })

    it(`AppLayout logo comes from theme ${id}`, () => {
      applyTheme(theme)
      const img = mountLayout(AppLayout).find('aside img')
      expect(img.attributes('src')).toBe(theme.logo.src)
      expect(img.attributes('alt')).toBe(theme.logo.alt)
    })
  }
})
