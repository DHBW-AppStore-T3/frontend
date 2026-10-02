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

vi.mock('../../env', () => ({
  env: {
    KEYCLOAK_URL: 'http://localhost:8080',
    KEYCLOAK_REALM: 'dhbw',
    KEYCLOAK_CLIENT_ID: 'test-client',
    APP_URL: 'http://localhost:5173',
  },
}))

describe('useKeycloak', () => {
  it('setLtiUser sets isAuthenticated and stores token', async () => {
    const { useKeycloak } = await import('../useKeycloak')
    const kc = useKeycloak()

    await kc.setLtiUser('teacher@dhbw.de', 'lti-session-token')

    expect(kc.isAuthenticated.value).toBe(true)
    expect(await kc.getAccessToken()).toBe('lti-session-token')
  })

  it('setHandoffUser sets isAuthenticated and stores token', async () => {
    vi.resetModules()
    const { useKeycloak } = await import('../useKeycloak')
    const kc = useKeycloak()

    await kc.setHandoffUser('student@dhbw.de', 'handoff-token')

    expect(kc.isAuthenticated.value).toBe(true)
    expect(await kc.getAccessToken()).toBe('handoff-token')
  })

  it('getAccessToken prefers ltiToken over handoffToken over keycloak session', async () => {
    vi.resetModules()
    const { useKeycloak } = await import('../useKeycloak')
    const kc = useKeycloak()

    await kc.setHandoffUser('student@dhbw.de', 'handoff-token')
    expect(await kc.getAccessToken()).toBe('handoff-token')

    await kc.setLtiUser('teacher@dhbw.de', 'lti-session-token')
    expect(await kc.getAccessToken()).toBe('lti-session-token')
  })
})
