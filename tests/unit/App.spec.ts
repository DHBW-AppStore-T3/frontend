import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '@/App.vue'

let mockMeta: Record<string, unknown> = {}

vi.mock('vue-router', () => ({
  useRoute: () => ({ meta: mockMeta }),
}))

function mountApp() {
  return mount(App, {
    global: {
      stubs: {
        AuthLayout: { template: '<div class="auth-layout"><slot /></div>' },
        AppLayout: { template: '<div class="app-layout"><slot /></div>' },
        UserLayout: { template: '<div class="user-layout"><slot /></div>' },
        Toast: true,
        RouterView: true,
      },
    },
  })
}

describe('App', () => {
  it('renders AppLayout by default when no layout meta is set', () => {
    mockMeta = {}
    const wrapper = mountApp()
    expect(wrapper.find('.app-layout').exists()).toBe(true)
  })

  it('renders AuthLayout when route.meta.layout is "auth"', () => {
    mockMeta = { layout: 'auth' }
    const wrapper = mountApp()
    expect(wrapper.find('.auth-layout').exists()).toBe(true)
  })

  it('renders UserLayout when route.meta.layout is "user"', () => {
    mockMeta = { layout: 'user' }
    const wrapper = mountApp()
    expect(wrapper.find('.user-layout').exists()).toBe(true)
  })

  it('always renders the global Toast host', () => {
    mockMeta = {}
    const wrapper = mountApp()
    expect(wrapper.findComponent({ name: 'Toast' }).exists()).toBe(true)
  })
})
