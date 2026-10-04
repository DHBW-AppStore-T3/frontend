import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { applyTheme } from '@/theme/applyTheme'
import { THEMES } from '@/theme'
import de from '@/i18n/locales/de'
import en from '@/i18n/locales/en'

function mountLayout(component: object) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/deployments', name: 'deployments.list', component: { template: '<div />' } },
    ],
  })
  const i18n = createI18n({ legacy: false, locale: 'de', missingWarn: false, fallbackWarn: false, messages: { de, en } })
  return mount(component, {
    global: { plugins: [createPinia(), router, i18n] },
    slots: { default: '<p>content</p>' },
  })
}

describe('layout branding', () => {
  afterEach(() => vi.restoreAllMocks())

  it('keeps the English phrase together when switching languages, even with blocked storage', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError')
    })
    const wrapper = mountLayout(AuthLayout)
    await wrapper.get('[data-testid="locale-en"]').trigger('click')
    expect(wrapper.findAll('.auth-title span').map(line => line.text()))
      .toEqual(['Deploy', 'applications with', 'ease'])
    expect(wrapper.get('.auth-title').classes()).toContain('auth-title--fixed-lines')
    await wrapper.get('[data-testid="locale-de"]').trigger('click')
    expect(wrapper.get('.auth-title').text()).toContain('Anwendungen einfach')
    expect(wrapper.get('.auth-title').classes()).not.toContain('auth-title--fixed-lines')
    wrapper.unmount()
  })
  for (const [id, theme] of Object.entries(THEMES)) {
    it(`AuthLayout renders the active theme (${id})`, () => {
      applyTheme(theme)
      const html = mountLayout(AuthLayout).html()
      expect(html).toContain(theme.authLogo?.src ?? theme.logo.src)
      expect(html).toContain(theme.brand.name)
      expect(html).toContain(theme.brand.tagline)
      expect(html).toContain(theme.loginBackground!)
    })

    it(`AppLayout logo comes from theme ${id}`, () => {
      applyTheme(theme)
      const img = mountLayout(AppLayout).find('aside img')
      expect(img.attributes('src')).toBe(theme.logo.src)
      expect(img.attributes('alt')).toBe(theme.logo.alt)
    })
  }
})
