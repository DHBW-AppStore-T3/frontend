import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const authStoreMock = {
  user: null as any,
  isAuthenticated: false,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
}

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => authStoreMock,
}))

import { useAuth } from '@/composables/useAuth'

describe('useAuth', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    authStoreMock.user = null
    authStoreMock.isAuthenticated = false
    authStoreMock.isLoading = false
  })

  it('exposes user, isAuthenticated, isLoading as computed refs', () => {
    const auth = useAuth()
    expect(auth.user.value).toBeNull()
    expect(auth.isAuthenticated.value).toBe(false)
    expect(auth.isLoading.value).toBe(false)
  })

  it('reflects store state changes', () => {
    const auth = useAuth()
    authStoreMock.isAuthenticated = true
    expect(auth.isAuthenticated.value).toBe(true)
  })

  it('login: delegates to authStore.login with returnUrl', async () => {
    authStoreMock.login.mockResolvedValue(undefined)
    const auth = useAuth()
    await auth.login('/dashboard')
    expect(authStoreMock.login).toHaveBeenCalledWith('/dashboard')
  })

  it('logout: delegates to authStore.logout', async () => {
    authStoreMock.logout.mockResolvedValue(undefined)
    const auth = useAuth()
    await auth.logout()
    expect(authStoreMock.logout).toHaveBeenCalledOnce()
  })

  it('login without returnUrl calls authStore.login with undefined', async () => {
    authStoreMock.login.mockResolvedValue(undefined)
    const auth = useAuth()
    await auth.login()
    expect(authStoreMock.login).toHaveBeenCalledWith(undefined)
  })
})
