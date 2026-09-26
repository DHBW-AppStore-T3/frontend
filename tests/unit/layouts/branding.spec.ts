import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { applyTheme } from '@/theme/applyTheme'
import { THEMES } from '@/theme'

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
  for (const [id, theme] of Object.entries(THEMES)) {
    it(`AuthLayout renders brand from theme ${id}`, () => {
      applyTheme(theme)
      const html = mountLayout(AuthLayout).html()
      expect(html).toContain(theme.brand.name)
      expect(html).toContain(theme.brand.tagline)
      if (id !== 'default') expect(html).not.toContain('SIX7')
    })

    it(`AppLayout logo comes from theme ${id}`, () => {
      applyTheme(theme)
      const img = mountLayout(AppLayout).find('aside img')
      expect(img.attributes('src')).toBe(theme.logo.src)
      expect(img.attributes('alt')).toBe(theme.logo.alt)
    })
  }
})
