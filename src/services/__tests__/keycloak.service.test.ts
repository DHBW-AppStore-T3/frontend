import { describe, it, expect, vi, beforeEach } from 'vitest'

const { signinRedirectCallback } = vi.hoisted(() => ({ signinRedirectCallback: vi.fn() }))

vi.mock('oidc-client-ts', () => {
  class UserManager {
    getUser = vi.fn(() => Promise.resolve(null))
    signinSilent = vi.fn(() => Promise.resolve(null))
    signinRedirect = vi.fn()
    signinRedirectCallback = signinRedirectCallback
    signoutRedirect = vi.fn()
  }
  class WebStorageStateStore {}
  class InMemoryWebStorage {}
  return { UserManager, WebStorageStateStore, InMemoryWebStorage }
})

vi.mock('@/env', () => ({
  env: {
    KEYCLOAK_URL: 'http://localhost:8080',
    KEYCLOAK_REALM: 'dhbw',
    KEYCLOAK_CLIENT_ID: 'test-client',
    APP_URL: 'http://localhost:5173',
  },
}))

describe('keycloak service', () => {
  beforeEach(() => {
    signinRedirectCallback.mockReset()
    sessionStorage.clear()
  })

  it('setLtiUser sets isAuthenticated and stores token', async () => {
    const { keycloak: kc } = await import('../keycloak.service')

    await kc.setLtiUser('teacher@dhbw.de', 'lti-session-token')

    expect(kc.getState().isAuthenticated).toBe(true)
    expect(await kc.getAccessToken()).toBe('lti-session-token')
  })

  it('has no handoff login any more (.github#7 N)', async () => {
    vi.resetModules()
    const { keycloak: kc } = await import('../keycloak.service')

    expect('setHandoffUser' in kc).toBe(false)
  })

  it('getAccessToken prefers the LTI token over the dev token', async () => {
    vi.resetModules()
    const { keycloak: kc } = await import('../keycloak.service')

    await kc.setDevUser('dev@dhbw.de')
    expect(await kc.getAccessToken()).toBe('dev-sso-token')

    await kc.setLtiUser('teacher@dhbw.de', 'lti-session-token')
    expect(await kc.getAccessToken()).toBe('lti-session-token')
  })

  it('notifies subscribers when the authentication state changes', async () => {
    vi.resetModules()
    const { keycloak: kc } = await import('../keycloak.service')
    const seen: boolean[] = []
    const unsubscribe = kc.subscribe((state) => seen.push(state.isAuthenticated))

    await kc.setDevUser('dev@dhbw.de')
    unsubscribe()
    await kc.setLtiUser('x@dhbw.de', 'tok')

    expect(seen).toEqual([true])
    expect(kc.getDevEmail()).toBe('x@dhbw.de')
    expect(await kc.getAccessToken()).toBe('tok')
  })

  it('getAccessToken returns the dev token for dev users', async () => {
    vi.resetModules()
    const { keycloak: kc } = await import('../keycloak.service')
    await kc.setDevUser('dev@dhbw.de')
    expect(await kc.getAccessToken()).toBe('dev-sso-token')
    expect(await kc.ensureValidToken()).toBe(true)
  })

  it('initialize ends unauthenticated and not loading without a session', async () => {
    vi.resetModules()
    const { keycloak: kc } = await import('../keycloak.service')
    expect(kc.getState().isLoading).toBe(true)

    await kc.initialize()

    expect(kc.getState().isAuthenticated).toBe(false)
    expect(kc.getState().isLoading).toBe(false)
  })

  describe('handleCallback', () => {
    it('redeems the authorization code once for concurrent calls (StrictMode)', async () => {
      vi.resetModules()
      const { keycloak: kc } = await import('../keycloak.service')
      let resolve!: (user: object) => void
      signinRedirectCallback.mockReturnValue(new Promise((r) => (resolve = r)))
      sessionStorage.setItem('returnUrl', '/apps')

      const first = kc.handleCallback()
      const second = kc.handleCallback()
      resolve({ access_token: 'tok', expired: false })

      expect(await first).toBe('/apps')
      expect(await second).toBe('/apps')
      expect(signinRedirectCallback).toHaveBeenCalledTimes(1)
      expect(kc.getState().isAuthenticated).toBe(true)
    })

    it('shares a failure and allows a new attempt afterwards', async () => {
      vi.resetModules()
      const { keycloak: kc } = await import('../keycloak.service')
      vi.spyOn(console, 'error').mockImplementation(() => {})
      signinRedirectCallback.mockRejectedValueOnce(new Error('Code not valid'))

      const results = await Promise.allSettled([kc.handleCallback(), kc.handleCallback()])

      expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected'])
      expect(signinRedirectCallback).toHaveBeenCalledTimes(1)

      signinRedirectCallback.mockResolvedValueOnce({ access_token: 'tok', expired: false })
      expect(await kc.handleCallback()).toBe('/')
      expect(signinRedirectCallback).toHaveBeenCalledTimes(2)
    })
  })
})
