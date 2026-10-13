import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'

function mountLayout() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'dashboard', component: { template: '<div />' } },
      { path: '/deployments', name: 'deployments.list', component: { template: '<div />' } },
      { path: '/apps', component: { template: '<div />' } },
      { path: '/courses', component: { template: '<div />' } },
      { path: '/admin/apps', component: { template: '<div />' } },
      { path: '/help', component: { template: '<div />' } },
    ],
  })
  const i18n = createI18n({ legacy: false, locale: 'de', missingWarn: false, fallbackWarn: false, messages: { de: {} } })
  return mount(AppLayout, {
    global: { plugins: [createPinia(), router, i18n] },
    slots: { default: '<p>page content</p>' },
  })
}

describe('AppLayout', () => {
  it('composes AppSidebar and AppHeader and renders the slot content', () => {
    const wrapper = mountLayout()
    expect(wrapper.find('aside').exists()).toBe(true)
    expect(wrapper.find('header').exists()).toBe(true)
    expect(wrapper.text()).toContain('page content')
  })

  it('opens the mobile menu when AppHeader emits open-mobile-menu', async () => {
    const wrapper = mountLayout()
    await wrapper.findComponent({ name: 'AppHeader' }).vm.$emit('open-mobile-menu')
    expect(wrapper.findComponent({ name: 'AppSidebar' }).props('mobileOpen')).toBe(true)
  })

  it('toggles sidebar collapsed state when AppHeader emits toggle-sidebar', async () => {
    const wrapper = mountLayout()
    expect(wrapper.findComponent({ name: 'AppSidebar' }).props('collapsed')).toBe(false)
    await wrapper.findComponent({ name: 'AppHeader' }).vm.$emit('toggle-sidebar')
    expect(wrapper.findComponent({ name: 'AppSidebar' }).props('collapsed')).toBe(true)
  })
})
