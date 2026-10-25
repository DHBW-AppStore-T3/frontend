import { describe, it, expect, vi, beforeEach } from 'vitest'
import { liveStore } from '../../../tests/helpers/liveStore'

const keycloakState = { isAuthenticated: false }
const keycloakListeners = new Set<(s: typeof keycloakState) => void>()

const keycloakMock = {
  getState: () => keycloakState,
  subscribe: vi.fn((listener: (s: typeof keycloakState) => void) => {
    keycloakListeners.add(listener)
    return () => keycloakListeners.delete(listener)
  }),
  initialize: vi.fn(),
  login: vi.fn(),
  handleCallback: vi.fn(),
  logout: vi.fn(),
  setLtiUser: vi.fn(() => Promise.resolve()),
}

vi.mock('@/services/keycloak.service', () => ({
  keycloak: keycloakMock,
}))

vi.mock('@/services/auth.service', () => ({
  AuthService: {
    fetchMe: vi.fn(),
    getStoredUser: vi.fn(() => null),
    clearStoredUser: vi.fn(),
  },
}))

describe('auth.store — LTI', () => {
  beforeEach(() => {
    vi.resetModules()
    keycloakState.isAuthenticated = false
    keycloakListeners.clear()
    vi.clearAllMocks()
  })

  it('setLtiUser creates stub user immediately', async () => {
    const { AuthService } = await import('@/services/auth.service')
    vi.mocked(AuthService.fetchMe).mockImplementation(() => new Promise(() => {}))
    const { useAuthStore } = await import('../auth.store')
    const store = liveStore(useAuthStore)

    await store.setLtiUser('teacher@dhbw.de', 'lti-token', 'teacher')

    expect(store.user).toMatchObject({ email: 'teacher@dhbw.de', role: 'teacher' })
    expect(keycloakMock.setLtiUser).toHaveBeenCalledWith('teacher@dhbw.de', 'lti-token')
  })

  it('setLtiUser replaces stub with fetchMe result on success', async () => {
    const { AuthService } = await import('@/services/auth.service')
    const realUser = {
      userId: 'u1',
      email: 'teacher@dhbw.de',
      username: 'teacher',
      role: 'teacher' as const,
      courseId: 'c1',
      created_at: '2026-01-01T00:00:00Z',
    }
    vi.mocked(AuthService.fetchMe).mockResolvedValueOnce(realUser)
    const { useAuthStore } = await import('../auth.store')
    const store = liveStore(useAuthStore)

    await store.setLtiUser('teacher@dhbw.de', 'lti-token', 'teacher')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(store.user).toEqual(realUser)
  })

  it('setLtiUser keeps stub when fetchMe fails', async () => {
    const { AuthService } = await import('@/services/auth.service')
    vi.mocked(AuthService.fetchMe).mockRejectedValueOnce(new Error('network error'))
    const { useAuthStore } = await import('../auth.store')
    const store = liveStore(useAuthStore)

    await store.setLtiUser('teacher@dhbw.de', 'lti-token', 'teacher')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(store.user).toMatchObject({ email: 'teacher@dhbw.de', role: 'teacher' })
  })

  it('mirrors keycloak.isAuthenticated into the store and follows changes', async () => {
    keycloakState.isAuthenticated = true
    const { useAuthStore } = await import('../auth.store')
    const store = liveStore(useAuthStore)
    expect(store.isAuthenticated).toBe(true)

    keycloakState.isAuthenticated = false
    keycloakListeners.forEach((l) => l(keycloakState))
    expect(store.isAuthenticated).toBe(false)
  })

  it('hasRole / hasAnyRole reflect the current user', async () => {
    const { useAuthStore } = await import('../auth.store')
    const store = liveStore(useAuthStore)
    expect(store.hasAnyRole('admin')).toBe(false)

    await store.setLtiUser('t@dhbw.de', 'tok', 'teacher')

    expect(store.hasRole('teacher')).toBe(true)
    expect(store.hasAnyRole('admin', 'teacher')).toBe(true)
    expect(store.hasAnyRole('admin')).toBe(false)
  })

  it('selectors derive role flags and userId from the user', async () => {
    const { useAuthStore, selectIsTeacherOrAdmin, selectUserId, selectIsStudent } = await import('../auth.store')
    const store = liveStore(useAuthStore)
    await store.setLtiUser('t@dhbw.de', 'tok', 'teacher')

    expect(selectUserId(store)).toBe('t@dhbw.de')
    expect(selectIsTeacherOrAdmin(store)).toBe(true)
    expect(selectIsStudent(store)).toBe(false)
  })

  it('logout clears the user, resets credentials and signs out of keycloak', async () => {
    const { useAuthStore } = await import('../auth.store')
    const store = liveStore(useAuthStore)
    await store.setLtiUser('t@dhbw.de', 'tok', 'teacher')

    await store.logout()

    expect(store.user).toBeNull()
    expect(keycloakMock.logout).toHaveBeenCalled()
  })
})
