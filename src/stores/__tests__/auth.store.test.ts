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
  setDevUser: vi.fn(() => Promise.resolve()),
  getAccessToken: vi.fn(() => Promise.resolve('mock-token')),
  ensureValidToken: vi.fn(() => Promise.resolve(true)),
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

/** Convenience: re-import store fresh after vi.resetModules().
 * Import auth.service first so its mock is cached before auth.store loads it. */
async function importStore() {
  const { AuthService } = await import('@/services/auth.service')
  const { useAuthStore } = await import('../auth.store')
  return { useAuthStore, AuthService: AuthService as typeof import('@/services/auth.service').AuthService }
}

// ===========================================================================
// initialize()
// ===========================================================================
describe('auth.store — initialize()', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('calls keycloak.initialize and sets isLoading=false after', async () => {
    keycloakMock.initialize.mockResolvedValue(undefined)
    keycloakMock.isAuthenticated.value = false
    const { useAuthStore } = await importStore()
    const store = useAuthStore()
    await store.initialize()
    expect(keycloakMock.initialize).toHaveBeenCalledOnce()
    expect(store.isLoading).toBe(false)
  })

  it('when authenticated and stored user exists, assigns it immediately', async () => {
    keycloakMock.initialize.mockResolvedValue(undefined)
    keycloakMock.isAuthenticated.value = true
    const { useAuthStore, AuthService } = await importStore()
    const storedUser = { userId: 'u1', email: 'a@b.de', username: 'a', role: 'student' as const, courseId: null, created_at: '' }
    vi.mocked(AuthService.getStoredUser).mockReturnValue(storedUser)
    vi.mocked(AuthService.fetchMe).mockResolvedValue(storedUser)
    const store = useAuthStore()
    await store.initialize()
    expect(store.user).toEqual(storedUser)
  })

  it('does not throw when keycloak.initialize rejects', async () => {
    keycloakMock.initialize.mockRejectedValue(new Error('Keycloak down'))
    keycloakMock.isAuthenticated.value = false
    const { useAuthStore } = await importStore()
    const store = useAuthStore()
    await expect(store.initialize()).resolves.toBeUndefined()
    expect(store.isLoading).toBe(false)
  })

  it('deduplicates concurrent calls: keycloak.initialize is called once', async () => {
    keycloakMock.initialize.mockResolvedValue(undefined)
    keycloakMock.isAuthenticated.value = false
    const { useAuthStore } = await importStore()
    const store = useAuthStore()
    await Promise.all([store.initialize(), store.initialize()])
    expect(keycloakMock.initialize).toHaveBeenCalledOnce()
  })
})

// ===========================================================================
// login()
// ===========================================================================
describe('auth.store — login()', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('delegates to keycloak.login with returnUrl', async () => {
    keycloakMock.login = vi.fn(() => Promise.resolve())
    const { useAuthStore } = await importStore()
    const store = useAuthStore()
    await store.login('/return')
    expect(keycloakMock.login).toHaveBeenCalledWith('/return')
    expect(store.error).toBeNull()
  })

  it('sets error and re-throws when keycloak.login rejects', async () => {
    keycloakMock.login = vi.fn(() => Promise.reject(Object.assign(new Error('pop blocked'), { message: 'pop blocked' })))
    const { useAuthStore } = await importStore()
    const store = useAuthStore()
    await expect(store.login()).rejects.toThrow('pop blocked')
    expect(store.error).toBe('pop blocked')
  })
})

// ===========================================================================
// handleCallback()
// ===========================================================================
describe('auth.store — handleCallback()', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('resolves returnUrl from keycloak and fetches the user', async () => {
    keycloakMock.handleCallback = vi.fn(() => Promise.resolve('/dashboard'))
    const { useAuthStore, AuthService } = await importStore()
    const user = { userId: 'u1', email: 'a@b.de', username: 'a', role: 'student' as const, courseId: null, created_at: '' }
    vi.mocked(AuthService.fetchMe).mockResolvedValue(user)
    const store = useAuthStore()
    const returnUrl = await store.handleCallback()
    expect(returnUrl).toBe('/dashboard')
    expect(store.user).toEqual(user)
    expect(store.isLoading).toBe(false)
  })

  it('sets error and re-throws when callback fails', async () => {
    keycloakMock.handleCallback = vi.fn(() => Promise.reject(new Error('invalid state')))
    const { useAuthStore } = await importStore()
    const store = useAuthStore()
    await expect(store.handleCallback()).rejects.toThrow('invalid state')
    expect(store.error).toBe('invalid state')
    expect(store.isLoading).toBe(false)
  })
})

// ===========================================================================
// fetchMe()
// ===========================================================================
describe('auth.store — fetchMe()', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('sets user from AuthService.fetchMe', async () => {
    const { useAuthStore, AuthService } = await importStore()
    const user = { userId: 'u1', email: 'a@b.de', username: 'a', role: 'student' as const, courseId: null, created_at: '' }
    vi.mocked(AuthService.fetchMe).mockResolvedValue(user)
    const store = useAuthStore()
    await store.fetchMe()
    expect(store.user).toEqual(user)
  })

  it('sets user=null and re-throws when fetchMe fails', async () => {
    const { useAuthStore, AuthService } = await importStore()
    vi.mocked(AuthService.fetchMe).mockRejectedValue(new Error('401'))
    const store = useAuthStore()
    await expect(store.fetchMe()).rejects.toThrow('401')
    expect(store.user).toBeNull()
  })

  it('deduplicates concurrent calls: AuthService.fetchMe called once', async () => {
    const { useAuthStore, AuthService } = await importStore()
    const user = { userId: 'u1', email: 'a@b.de', username: 'a', role: 'student' as const, courseId: null, created_at: '' }
    vi.mocked(AuthService.fetchMe).mockResolvedValue(user)
    const store = useAuthStore()
    await Promise.all([store.fetchMe(), store.fetchMe()])
    expect(AuthService.fetchMe).toHaveBeenCalledOnce()
  })
})

// ===========================================================================
// logout()
// ===========================================================================
describe('auth.store — logout()', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('clears user and calls keycloak.logout', async () => {
    keycloakMock.logout = vi.fn(() => Promise.resolve())
    const { useAuthStore, AuthService } = await importStore()
    const user = { userId: 'u1', email: 'a@b.de', username: 'a', role: 'student' as const, courseId: null, created_at: '' }
    vi.mocked(AuthService.fetchMe).mockResolvedValue(user)
    const store = useAuthStore()
    await store.fetchMe()
    expect(store.user).not.toBeNull()
    await store.logout()
    expect(store.user).toBeNull()
    expect(keycloakMock.logout).toHaveBeenCalledOnce()
    expect(AuthService.clearStoredUser).toHaveBeenCalledOnce()
  })

  it('does not throw when keycloak.logout rejects', async () => {
    keycloakMock.logout = vi.fn(() => Promise.reject(new Error('logout failed')))
    const { useAuthStore } = await importStore()
    const store = useAuthStore()
    await expect(store.logout()).resolves.toBeUndefined()
  })
})

// ===========================================================================
// setDevUser()
// ===========================================================================
describe('auth.store — setDevUser()', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('sets stub user immediately then replaces via fetchMe', async () => {
    const { useAuthStore, AuthService } = await importStore()
    const realUser = { userId: 'dev@dhbw.de', email: 'dev@dhbw.de', username: 'dev@dhbw.de', role: 'student' as const, courseId: null, created_at: '2026-01-01T00:00:00Z' }
    vi.mocked(AuthService.fetchMe).mockResolvedValue(realUser)
    const store = useAuthStore()
    await store.setDevUser('dev@dhbw.de')
    expect(store.user).toMatchObject({ email: 'dev@dhbw.de', role: 'student' })
    await vi.waitFor(() => expect(store.user).toMatchObject({ email: 'dev@dhbw.de', created_at: '2026-01-01T00:00:00Z' }))
  })
})

// ===========================================================================
// LTI and handoff (original tests, kept for regression)
// ===========================================================================
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

// ===========================================================================
// buildStubUser() / hasRole() / hasAnyRole() / getters
// ===========================================================================
describe('auth.store — helpers and getters', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('buildStubUser constructs a minimal user with the given role', async () => {
    const { useAuthStore } = await importStore()
    const store = useAuthStore()
    const stub = store.buildStubUser('admin@dhbw.de', 'admin')
    expect(stub).toMatchObject({ email: 'admin@dhbw.de', role: 'admin', userId: 'admin@dhbw.de' })
  })

  it('hasRole: true when user has the role', async () => {
    const { useAuthStore } = await importStore()
    const store = useAuthStore()
    store.user = store.buildStubUser('a@b.de', 'teacher')
    expect(store.hasRole('teacher')).toBe(true)
    expect(store.hasRole('admin')).toBe(false)
  })

  it('hasAnyRole: true when user has one of the roles', async () => {
    const { useAuthStore } = await importStore()
    const store = useAuthStore()
    store.user = store.buildStubUser('a@b.de', 'teacher')
    expect(store.hasAnyRole('student', 'teacher')).toBe(true)
    expect(store.hasAnyRole('admin')).toBe(false)
  })

  it('hasAnyRole: false when user is null', async () => {
    const { useAuthStore } = await importStore()
    const store = useAuthStore()
    expect(store.hasAnyRole('student')).toBe(false)
  })

  it('isStudent / isTeacher / isAdmin / isTeacherOrAdmin getters', async () => {
    const { useAuthStore } = await importStore()
    const store = useAuthStore()
    store.user = store.buildStubUser('t@b.de', 'teacher')
    expect(store.isStudent).toBe(false)
    expect(store.isTeacher).toBe(true)
    expect(store.isAdmin).toBe(false)
    expect(store.isTeacherOrAdmin).toBe(true)
  })

  it('userRole getter returns null when user is null', async () => {
    const { useAuthStore } = await importStore()
    const store = useAuthStore()
    expect(store.userRole).toBeNull()
    expect(store.userId).toBeNull()
  })

  it('userId getter returns userId from user', async () => {
    const { useAuthStore } = await importStore()
    const store = useAuthStore()
    store.user = store.buildStubUser('u@b.de', 'student')
    expect(store.userId).toBe('u@b.de')
  })
})
