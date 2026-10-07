import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPush = vi.fn()
const mockRoute = { query: {} }

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => mockRoute,
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}))

const mockLogin = vi.fn()
let mockIsAuthenticated = false

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    get isAuthenticated() { return mockIsAuthenticated },
    login: mockLogin,
  }),
}))

import LoginView from '@/views/LoginView.vue'

beforeEach(() => {
  vi.clearAllMocks()
  mockIsAuthenticated = false
  mockRoute.query = {}
})

const mount_ = () =>
  mount(LoginView, {
    global: { mocks: { $t: (k: string) => k } },
  })

describe('LoginView.vue', () => {
  it('renders the login button', () => {
    const wrapper = mount_()
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('shows i18n keys for info, button, no-account', () => {
    const wrapper = mount_()
    const text = wrapper.text()
    expect(text).toContain('auth.login.keycloakInfo')
    expect(text).toContain('auth.login.keycloakButton')
    expect(text).toContain('auth.login.noAccount')
  })

  it('calls authStore.login with returnUrl when button is clicked', async () => {
    mockLogin.mockResolvedValue(undefined)
    ;(mockRoute as any).query = { returnUrl: '/apps' }
    const wrapper = mount_()
    await wrapper.find('button').trigger('click')
    expect(mockLogin).toHaveBeenCalledWith('/apps')
  })

  it('defaults returnUrl to /dashboard when query param is missing', async () => {
    mockLogin.mockResolvedValue(undefined)
    const wrapper = mount_()
    await wrapper.find('button').trigger('click')
    expect(mockLogin).toHaveBeenCalledWith('/dashboard')
  })

  it('redirects to returnUrl when already authenticated on mount', async () => {
    mockIsAuthenticated = true
    ;(mockRoute as any).query = { returnUrl: '/courses' }
    mount_()
    await flushPromises()
    expect(mockPush).toHaveBeenCalledWith('/courses')
  })

  it('does not redirect when not authenticated', async () => {
    mockIsAuthenticated = false
    mount_()
    await flushPromises()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
