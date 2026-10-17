import { describe, it, expect, vi } from 'vitest'

vi.mock('oidc-client-ts', () => {
  class UserManager {
    getUser = vi.fn(() => Promise.resolve(null))
    signinSilent = vi.fn(() => Promise.resolve(null))
    signinRedirect = vi.fn()
    signinRedirectCallback = vi.fn()
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
  it('setLtiUser sets isAuthenticated and stores token', async () => {
    const { keycloak: kc } = await import('../keycloak.service')

    await kc.setLtiUser('teacher@dhbw.de', 'lti-session-token')

    expect(kc.getState().isAuthenticated).toBe(true)
    expect(await kc.getAccessToken()).toBe('lti-session-token')
  })

  it('setHandoffUser sets isAuthenticated and stores token', async () => {
    vi.resetModules()
    const { keycloak: kc } = await import('../keycloak.service')

    await kc.setHandoffUser('student@dhbw.de', 'handoff-token')

    expect(kc.getState().isAuthenticated).toBe(true)
    expect(await kc.getAccessToken()).toBe('handoff-token')
  })

  it('getAccessToken prefers ltiToken over handoffToken over keycloak session', async () => {
    vi.resetModules()
    const { keycloak: kc } = await import('../keycloak.service')

    await kc.setHandoffUser('student@dhbw.de', 'handoff-token')
    expect(await kc.getAccessToken()).toBe('handoff-token')

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
})
