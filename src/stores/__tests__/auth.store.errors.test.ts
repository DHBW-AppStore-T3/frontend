import { describe, it, expect, vi, beforeEach } from 'vitest'
import { liveStore } from '../../../tests/helpers/liveStore'

// Characterization of the error handling in login() and handleCallback()
// (frontend#87). The store keeps the thrown error's own `message`, falls back
// to a fixed text when there is none, and always rethrows the original value.

const keycloakMock = {
  getState: () => ({ isAuthenticated: false }),
  subscribe: vi.fn(() => () => {}),
  initialize: vi.fn(),
  login: vi.fn(),
  handleCallback: vi.fn(),
  logout: vi.fn(),
  setLtiUser: vi.fn(() => Promise.resolve()),
}

vi.mock('@/services/keycloak.service', () => ({ keycloak: keycloakMock }))
vi.mock('@/services/auth.service', () => ({
  AuthService: { fetchMe: vi.fn(), getStoredUser: vi.fn(() => null), clearStoredUser: vi.fn() },
}))

async function freshStore() {
  const { useAuthStore } = await import('../auth.store')
  return liveStore(useAuthStore)
}

describe('auth.store — error handling', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe('login', () => {
    it('stores the message of an Error and rethrows it', async () => {
      const failure = new Error('keycloak unreachable')
      keycloakMock.login.mockRejectedValue(failure)
      const store = await freshStore()

      await expect(store.login('/apps')).rejects.toBe(failure)
      expect(store.error).toBe('keycloak unreachable')
    })

    it('stores the message of a plain object with a message', async () => {
      keycloakMock.login.mockRejectedValue({ message: 'denied' })
      const store = await freshStore()

      await expect(store.login()).rejects.toEqual({ message: 'denied' })
      expect(store.error).toBe('denied')
    })

    it.each([
      ['an empty message', new Error('')],
      ['no message', {}],
      ['a string', 'boom'],
    ])('falls back to "Login failed" for %s', async (_label, failure) => {
      keycloakMock.login.mockRejectedValue(failure)
      const store = await freshStore()

      await expect(store.login()).rejects.toBe(failure)
      expect(store.error).toBe('Login failed')
    })

    it('clears a previous error before trying again', async () => {
      keycloakMock.login.mockRejectedValueOnce(new Error('first')).mockResolvedValueOnce(undefined)
      const store = await freshStore()

      await expect(store.login()).rejects.toThrow('first')
      await store.login()
      expect(store.error).toBeNull()
    })
  })

  describe('handleCallback', () => {
    it('stores the message of an Error, rethrows it and ends loading', async () => {
      const failure = new Error('invalid state')
      keycloakMock.handleCallback.mockRejectedValue(failure)
      const store = await freshStore()

      await expect(store.handleCallback()).rejects.toBe(failure)
      expect(store.error).toBe('invalid state')
      expect(store.isLoading).toBe(false)
    })

    it.each([
      ['an empty message', new Error('')],
      ['no message', {}],
      ['a string', 'boom'],
    ])('falls back to "Callback handling failed" for %s', async (_label, failure) => {
      keycloakMock.handleCallback.mockRejectedValue(failure)
      const store = await freshStore()

      await expect(store.handleCallback()).rejects.toBe(failure)
      expect(store.error).toBe('Callback handling failed')
      expect(store.isLoading).toBe(false)
    })
  })
})
