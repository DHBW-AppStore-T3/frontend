import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import AppHeader from '@/layouts/AppHeader.vue'

function mountHeader(props: Record<string, unknown> = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }, { path: '/user', component: { template: '<div />' } }],
  })
  const i18n = createI18n({ legacy: false, locale: 'de', missingWarn: false, fallbackWarn: false, messages: { de: {} } })
  return mount(AppHeader, {
    props: { pageTitle: 'Dashboard', sidebarCollapsed: false, ...props },
    global: { plugins: [createPinia(), router, i18n] },
  })
}

describe('AppHeader', () => {
  it('renders as a <header> element', () => {
    const wrapper = mountHeader()
    expect(wrapper.element.tagName).toBe('HEADER')
  })

  it('shows the page title without fixed positioning', () => {
    const wrapper = mountHeader({ pageTitle: 'Deployments' })
    expect(wrapper.text()).toContain('Deployments')
    expect(wrapper.html()).not.toContain('position: fixed')
    expect(wrapper.html()).not.toMatch(/header-title/)
  })

  it('emits toggle-sidebar when the sidebar toggle button is clicked', async () => {
    const wrapper = mountHeader({ sidebarCollapsed: false })
    await wrapper.find('[aria-label="workspace.closeSidebar"]').trigger('click')
    expect(wrapper.emitted('toggle-sidebar')).toHaveLength(1)
  })

  it('emits open-mobile-menu when the hamburger button is clicked', async () => {
    const wrapper = mountHeader()
    await wrapper.find('[data-testid="mobile-menu-toggle"]').trigger('click')
    expect(wrapper.emitted('open-mobile-menu')).toHaveLength(1)
  })
})
