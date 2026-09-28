import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock oidc-client-ts before any import of useKeycloak
// ---------------------------------------------------------------------------
const mockUserManager = {
  getUser: vi.fn(),
  signinRedirect: vi.fn(),
  signinRedirectCallback: vi.fn(),
  signinSilent: vi.fn(),
  signoutRedirect: vi.fn(),
}

vi.mock('oidc-client-ts', () => ({
  UserManager: vi.fn(() => mockUserManager),
  WebStorageStateStore: vi.fn(() => ({})),
  InMemoryWebStorage: vi.fn(() => ({})),
  User: class MockUser {},
}))

vi.mock('@/env', () => ({
  env: {
    KEYCLOAK_URL: 'http://keycloak.test',
    KEYCLOAK_REALM: 'test-realm',
    KEYCLOAK_CLIENT_ID: 'test-client',
    APP_URL: 'http://localhost:5173',
    API_URL: 'http://localhost:8000',
    THEME: 'default',
  },
}))

/** Fresh import after vi.resetModules() so module-level state is clean. */
async function importKeycloak() {
  const { useKeycloak } = await import('@/composables/useKeycloak')
  return useKeycloak()
}

// ---------------------------------------------------------------------------
// Pure state-setting helpers (no UserManager interaction needed)
// ---------------------------------------------------------------------------
describe('useKeycloak — state setters', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('setDevUser: sets isAuthenticated and devEmail', async () => {
    const kc = await importKeycloak()
    await kc.setDevUser('dev@dhbw.de')
    expect(kc.isAuthenticated.value).toBe(true)
    expect(kc.isLoading.value).toBe(false)
    expect(kc.getDevEmail()).toBe('dev@dhbw.de')
  })

  it('setLtiUser: sets isAuthenticated and stores the LTI token', async () => {
    const kc = await importKeycloak()
    await kc.setLtiUser('lti@dhbw.de', 'lti-token-123')
    expect(kc.isAuthenticated.value).toBe(true)
    expect(kc.isLoading.value).toBe(false)
    expect(await kc.getAccessToken()).toBe('lti-token-123')
  })

  it('setHandoffUser: sets isAuthenticated and stores the handoff token', async () => {
    const kc = await importKeycloak()
    await kc.setHandoffUser('handoff@dhbw.de', 'handoff-token-456')
    expect(kc.isAuthenticated.value).toBe(true)
    expect(await kc.getAccessToken()).toBe('handoff-token-456')
  })

  it('getDevEmail: returns null when not set', async () => {
    const kc = await importKeycloak()
    expect(kc.getDevEmail()).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getAccessToken — token priority order
// ---------------------------------------------------------------------------
describe('useKeycloak — getAccessToken()', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns "dev-sso-token" for dev user (before UserManager)', async () => {
    const kc = await importKeycloak()
    await kc.setDevUser('dev@dhbw.de')
    expect(await kc.getAccessToken()).toBe('dev-sso-token')
  })

  it('returns null when userManager.getUser returns null', async () => {
    mockUserManager.getUser.mockResolvedValue(null)
    const kc = await importKeycloak()
    expect(await kc.getAccessToken()).toBeNull()
  })

  it('returns the access_token when user exists and is not expired', async () => {
    mockUserManager.getUser.mockResolvedValue({ expired: false, access_token: 'valid-tok' })
    const kc = await importKeycloak()
    expect(await kc.getAccessToken()).toBe('valid-tok')
  })

  it('triggers silent refresh when user is expired', async () => {
    const refreshed = { expired: false, access_token: 'refreshed-tok' }
    mockUserManager.getUser.mockResolvedValue({ expired: true, access_token: 'old-tok' })
    mockUserManager.signinSilent.mockResolvedValue(refreshed)
    const kc = await importKeycloak()
    const token = await kc.getAccessToken()
    expect(mockUserManager.signinSilent).toHaveBeenCalledOnce()
    expect(token).toBe('refreshed-tok')
  })

  it('returns null when getUser throws', async () => {
    mockUserManager.getUser.mockRejectedValue(new Error('storage error'))
    const kc = await importKeycloak()
    expect(await kc.getAccessToken()).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// ensureValidToken
// ---------------------------------------------------------------------------
describe('useKeycloak — ensureValidToken()', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns true immediately when ltiToken is set', async () => {
    const kc = await importKeycloak()
    await kc.setLtiUser('lti@dhbw.de', 'tok')
    expect(await kc.ensureValidToken()).toBe(true)
  })

  it('returns true immediately when handoffToken is set', async () => {
    const kc = await importKeycloak()
    await kc.setHandoffUser('h@dhbw.de', 'tok')
    expect(await kc.ensureValidToken()).toBe(true)
  })

  it('returns true immediately when devEmail is set', async () => {
    const kc = await importKeycloak()
    await kc.setDevUser('dev@dhbw.de')
    expect(await kc.ensureValidToken()).toBe(true)
  })

  it('returns false when no user', async () => {
    mockUserManager.getUser.mockResolvedValue(null)
    const kc = await importKeycloak()
    expect(await kc.ensureValidToken()).toBe(false)
  })

  it('returns true when user is fresh', async () => {
    mockUserManager.getUser.mockResolvedValue({ expired: false })
    const kc = await importKeycloak()
    expect(await kc.ensureValidToken()).toBe(true)
  })

  it('returns false when ensureValidToken throws', async () => {
    mockUserManager.getUser.mockRejectedValue(new Error('err'))
    const kc = await importKeycloak()
    expect(await kc.ensureValidToken()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// initialize()
// ---------------------------------------------------------------------------
describe('useKeycloak — initialize()', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('sets isAuthenticated when stored user is fresh', async () => {
    mockUserManager.getUser.mockResolvedValue({ expired: false, access_token: 'tok' })
    const kc = await importKeycloak()
    await kc.initialize()
    expect(kc.isAuthenticated.value).toBe(true)
    expect(kc.isLoading.value).toBe(false)
  })

  it('falls back to silent refresh when stored user is null', async () => {
    const refreshed = { expired: false, access_token: 'new-tok' }
    mockUserManager.getUser.mockResolvedValue(null)
    mockUserManager.signinSilent.mockResolvedValue(refreshed)
    const kc = await importKeycloak()
    await kc.initialize()
    expect(kc.isAuthenticated.value).toBe(true)
  })

  it('sets isAuthenticated=false when stored user is expired and silent refresh fails', async () => {
    mockUserManager.getUser.mockResolvedValue({ expired: true })
    mockUserManager.signinSilent.mockRejectedValue(new Error('no session'))
    const kc = await importKeycloak()
    await kc.initialize()
    expect(kc.isAuthenticated.value).toBe(false)
    expect(kc.isLoading.value).toBe(false)
  })

  it('sets isAuthenticated=false when getUser throws', async () => {
    mockUserManager.getUser.mockRejectedValue(new Error('storage error'))
    const kc = await importKeycloak()
    await kc.initialize()
    expect(kc.isAuthenticated.value).toBe(false)
    expect(kc.isLoading.value).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// login / logout / handleCallback
// ---------------------------------------------------------------------------
describe('useKeycloak — auth flow', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('login: calls signinRedirect', async () => {
    mockUserManager.signinRedirect.mockResolvedValue(undefined)
    const kc = await importKeycloak()
    await kc.login('/return')
    expect(mockUserManager.signinRedirect).toHaveBeenCalledOnce()
  })

  it('login: re-throws on failure', async () => {
    mockUserManager.signinRedirect.mockRejectedValue(new Error('popup blocked'))
    const kc = await importKeycloak()
    await expect(kc.login()).rejects.toThrow('popup blocked')
  })

  it('handleCallback: processes the redirect and returns a URL', async () => {
    const callbackUser = { expired: false, access_token: 'cb-token' }
    mockUserManager.signinRedirectCallback.mockResolvedValue(callbackUser)
    const kc = await importKeycloak()
    const url = await kc.handleCallback()
    expect(kc.isAuthenticated.value).toBe(true)
    expect(typeof url).toBe('string')
  })

  it('handleCallback: re-throws on failure', async () => {
    mockUserManager.signinRedirectCallback.mockRejectedValue(new Error('invalid state'))
    const kc = await importKeycloak()
    await expect(kc.handleCallback()).rejects.toThrow('invalid state')
  })

  it('logout: calls signoutRedirect and clears state', async () => {
    mockUserManager.signoutRedirect.mockResolvedValue(undefined)
    const kc = await importKeycloak()
    await kc.setDevUser('dev@dhbw.de')
    await kc.logout()
    expect(mockUserManager.signoutRedirect).toHaveBeenCalledOnce()
    expect(kc.isAuthenticated.value).toBe(false)
  })

  it('logout: re-throws on failure', async () => {
    mockUserManager.signoutRedirect.mockRejectedValue(new Error('logout error'))
    const kc = await importKeycloak()
    await expect(kc.logout()).rejects.toThrow('logout error')
  })
})
