import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// ---------------------------------------------------------------------------
// Shared global mocks
// ---------------------------------------------------------------------------
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn(), push: vi.fn() })),
  useRoute: vi.fn(() => ({ meta: { layout: 'app' } })),
  RouterLink: { template: '<a><slot /></a>' },
  RouterView: { template: '<div />' },
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

// ---------------------------------------------------------------------------
// AppVersionStatusBadge — computed variant per status
// ---------------------------------------------------------------------------
import AppVersionStatusBadge from '@/components/ui/AppVersionStatusBadge.vue'

describe('AppVersionStatusBadge', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it.each([
    ['new', 'AppVersionStatusBadge.new'],
    ['pending', 'AppVersionStatusBadge.pending'],
    ['approved', 'AppVersionStatusBadge.published'],
    ['published', 'AppVersionStatusBadge.published'],
    ['rejected', 'AppVersionStatusBadge.rejected'],
    ['private', 'AppVersionStatusBadge.private'],
    ['unknown-status', '-'],
  ])('renders %s status without error', (status, expectedLabel) => {
    const wrapper = mount(AppVersionStatusBadge, { props: { status: status as any } })
    expect(wrapper.text()).toContain(expectedLabel)
  })
})

// ---------------------------------------------------------------------------
// ForbiddenView
// ---------------------------------------------------------------------------
import ForbiddenView from '@/views/ForbiddenView.vue'

vi.mock('@/components/ui/BaseButton.vue', () => ({
  default: {
    name: 'BaseButton',
    template: '<button @click="$emit(\'click\')"><slot /></button>',
  },
}))

describe('ForbiddenView', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders the 403 page', () => {
    const wrapper = mount(ForbiddenView, {
      global: { stubs: { BaseButton: true } },
    })
    expect(wrapper.text()).toContain('ForbiddenView.title')
    expect(wrapper.text()).toContain('ForbiddenView.description')
  })

  it('navigates to /dashboard when back button is clicked', async () => {
    const { useRouter } = await import('vue-router')
    const replaceMock = vi.fn()
    ;(useRouter as any).mockReturnValue({ replace: replaceMock })

    const wrapper = mount(ForbiddenView, {
      global: { stubs: { BaseButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' } } },
    })
    await wrapper.find('button').trigger('click')
    expect(replaceMock).toHaveBeenCalledWith('/dashboard')
  })
})

// ---------------------------------------------------------------------------
// UserLayout — just renders
// ---------------------------------------------------------------------------
import UserLayout from '@/layouts/UserLayout.vue'

describe('UserLayout', () => {
  it('renders header and slot content', () => {
    const wrapper = mount(UserLayout, {
      slots: { default: '<p class="content">hello</p>' },
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
        mocks: { $t: (k: string) => k },
      },
    })
    expect(wrapper.find('.content').exists()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// App.vue — layout switching
// ---------------------------------------------------------------------------
import App from '@/App.vue'

vi.mock('@/layouts/AuthLayout.vue', () => ({ default: { template: '<div class="auth-layout"><slot /></div>' } }))
vi.mock('@/layouts/AppLayout.vue', () => ({ default: { template: '<div class="app-layout"><slot /></div>' } }))
vi.mock('@/layouts/UserLayout.vue', () => ({ default: { template: '<div class="user-layout"><slot /></div>' } }))
vi.mock('@/components/ui/Toast.vue', () => ({ default: { template: '<div />' } }))

describe('App.vue', () => {
  it('uses AppLayout by default (no layout meta)', async () => {
    const { useRoute } = await import('vue-router')
    ;(useRoute as any).mockReturnValue({ meta: {} })

    const wrapper = mount(App, {
      global: {
        stubs: { RouterView: { template: '<div />' } },
      },
    })
    expect(wrapper.find('.app-layout').exists()).toBe(true)
  })

  it('uses AuthLayout when meta.layout = auth', async () => {
    const { useRoute } = await import('vue-router')
    ;(useRoute as any).mockReturnValue({ meta: { layout: 'auth' } })

    const wrapper = mount(App, {
      global: {
        stubs: { RouterView: { template: '<div />' } },
      },
    })
    expect(wrapper.find('.auth-layout').exists()).toBe(true)
  })

  it('uses UserLayout when meta.layout = user', async () => {
    const { useRoute } = await import('vue-router')
    ;(useRoute as any).mockReturnValue({ meta: { layout: 'user' } })

    const wrapper = mount(App, {
      global: {
        stubs: { RouterView: { template: '<div />' } },
      },
    })
    expect(wrapper.find('.user-layout').exists()).toBe(true)
  })
})
