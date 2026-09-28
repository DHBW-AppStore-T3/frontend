import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const keycloakMock = {
  isAuthenticated: { value: false },
  initialize: vi.fn(),
  login: vi.fn(),
  handleCallback: vi.fn(),
  logout: vi.fn(),
  setLtiUser: vi.fn(() => Promise.resolve()),
  setHandoffUser: vi.fn(() => Promise.resolve()),
}

vi.mock('@/composables/useKeycloak', () => ({
  useKeycloak: () => keycloakMock,
}))

vi.mock('@/composables/useOpenStackResourceCache', () => ({
  invalidateAll: vi.fn(),
}))

vi.mock('@/stores/openstack-credentials.store', () => ({
  useOpenStackCredentialsStore: () => ({
    fetch: vi.fn(() => Promise.resolve()),
    reset: vi.fn(),
  }),
}))

vi.mock('@/services/auth.service', () => ({
  AuthService: {
    fetchMe: vi.fn(),
    getStoredUser: vi.fn(() => null),
    clearStoredUser: vi.fn(),
  },
}))

describe('auth.store — LTI and handoff', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('setLtiUser creates stub user immediately', async () => {
    const { AuthService } = await import('@/services/auth.service')
    vi.mocked(AuthService.fetchMe).mockImplementation(() => new Promise(() => {}))
    const { useAuthStore } = await import('../auth.store')
    const store = useAuthStore()

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
    const store = useAuthStore()

    await store.setLtiUser('teacher@dhbw.de', 'lti-token', 'teacher')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(store.user).toEqual(realUser)
  })

  it('setHandoffUser creates stub and replaces via fetchMe', async () => {
    const { AuthService } = await import('@/services/auth.service')
    const realUser = {
      userId: 'u2',
      email: 'student@dhbw.de',
      username: 'student',
      role: 'student' as const,
      courseId: null,
      created_at: '2026-01-01T00:00:00Z',
    }
    vi.mocked(AuthService.fetchMe).mockResolvedValueOnce(realUser)
    const { useAuthStore } = await import('../auth.store')
    const store = useAuthStore()

    await store.setHandoffUser('student@dhbw.de', 'handoff-token')

    expect(keycloakMock.setHandoffUser).toHaveBeenCalledWith('student@dhbw.de', 'handoff-token')
    await vi.waitFor(() => expect(store.user).toEqual(realUser))
  })

  it('setLtiUser keeps stub when fetchMe fails', async () => {
    const { AuthService } = await import('@/services/auth.service')
    vi.mocked(AuthService.fetchMe).mockRejectedValueOnce(new Error('network error'))
    const { useAuthStore } = await import('../auth.store')
    const store = useAuthStore()

    await store.setLtiUser('teacher@dhbw.de', 'lti-token', 'teacher')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(store.user).toMatchObject({ email: 'teacher@dhbw.de', role: 'teacher' })
  })
})
