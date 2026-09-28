import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { LayoutDashboard } from 'lucide-vue-next'
import AppSidebar from '@/layouts/AppSidebar.vue'
import { applyTheme } from '@/theme/applyTheme'
import { THEMES } from '@/theme'

function mountSidebar(props: Record<string, unknown> = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  const i18n = createI18n({ legacy: false, locale: 'de', missingWarn: false, fallbackWarn: false, messages: { de: {} } })
  return mount(AppSidebar, {
    props: {
      collapsed: false,
      mobileOpen: false,
      navItems: [{ to: '/', label: 'nav.dashboard', icon: LayoutDashboard }],
      ...props,
    },
    global: { plugins: [router, i18n] },
  })
}

const ORIGINAL_WIDTH = window.innerWidth

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })
  window.dispatchEvent(new Event('resize'))
}

describe('AppSidebar', () => {
  beforeEach(() => {
    applyTheme(THEMES.t3!)
  })

  afterEach(() => {
    setViewportWidth(ORIGINAL_WIDTH)
  })

  it('renders as an <aside> permanent column at desktop width (>= 768px)', () => {
    setViewportWidth(1024)
    const wrapper = mountSidebar()
    expect(wrapper.find('aside').exists()).toBe(true)
  })

  it('renders the logo from the active theme', () => {
    setViewportWidth(1024)
    const wrapper = mountSidebar()
    const img = wrapper.find('img')
    expect(img.attributes('src')).toBe(THEMES.t3!.logo.src)
  })

  it('renders nav items with their translation key label', () => {
    setViewportWidth(1024)
    const wrapper = mountSidebar()
    expect(wrapper.text()).toContain('nav.dashboard')
  })

  it('switches to a Drawer-based mobile mode below 768px', async () => {
    setViewportWidth(500)
    const wrapper = mountSidebar({ mobileOpen: true })
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent({ name: 'Drawer' }).exists()).toBe(true)
  })

  it('emits close-mobile when the mobile drawer closes', async () => {
    setViewportWidth(500)
    const wrapper = mountSidebar({ mobileOpen: true })
    await wrapper.vm.$nextTick()
    const drawer = wrapper.findComponent({ name: 'Drawer' })
    await drawer.vm.$emit('close')
    expect(wrapper.emitted('close-mobile')).toHaveLength(1)
  })
})
