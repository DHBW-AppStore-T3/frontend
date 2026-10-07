import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import LoginView from '@/views/LoginView.vue'
import de from '@/i18n/locales/de'
import en from '@/i18n/locales/en'

const mocks = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockLogin: vi.fn(),
}))

let mockIsAuthenticated = false
let mockQuery: Record<string, string> = {}

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.mockPush }),
  useRoute: () => ({ query: mockQuery }),
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    get isAuthenticated() {
      return mockIsAuthenticated
    },
    login: mocks.mockLogin,
  }),
}))

function mountView() {
  const i18n = createI18n({ legacy: false, locale: 'de', messages: { de, en } })
  return mount(LoginView, { global: { plugins: [i18n], stubs: { LogIn: true } } })
}

beforeEach(() => {
  mockIsAuthenticated = false
  mockQuery = {}
  mocks.mockPush.mockClear()
  mocks.mockLogin.mockClear()
})

describe('LoginView', () => {
  it('renders the Keycloak login call to action', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain(de.auth.login.keycloakInfo)
    expect(wrapper.text()).toContain(de.auth.login.keycloakButton)
    expect(wrapper.text()).toContain(de.auth.login.noAccount)
  })

  it('redirects to the dashboard immediately when already authenticated', () => {
    mockIsAuthenticated = true
    mountView()
    expect(mocks.mockPush).toHaveBeenCalledWith('/dashboard')
  })

  it('redirects to the returnUrl query param when already authenticated', () => {
    mockIsAuthenticated = true
    mockQuery = { returnUrl: '/apps' }
    mountView()
    expect(mocks.mockPush).toHaveBeenCalledWith('/apps')
  })

  it('does not redirect when not authenticated', () => {
    mountView()
    expect(mocks.mockPush).not.toHaveBeenCalled()
  })

  it('starts the Keycloak login flow with the default return url on click', async () => {
    mocks.mockLogin.mockResolvedValue(undefined)
    const wrapper = mountView()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(mocks.mockLogin).toHaveBeenCalledWith('/dashboard')
  })

  it('passes the returnUrl query param through to login()', async () => {
    mockQuery = { returnUrl: '/apps/42' }
    mocks.mockLogin.mockResolvedValue(undefined)
    const wrapper = mountView()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(mocks.mockLogin).toHaveBeenCalledWith('/apps/42')
  })

  it('swallows a failed login redirect instead of throwing', async () => {
    mocks.mockLogin.mockRejectedValue(new Error('keycloak unreachable'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mountView()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
