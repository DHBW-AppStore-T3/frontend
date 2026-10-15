import { describe, it, expect, vi, beforeEach } from 'vitest'

const mountMock = vi.fn()
const useMock = vi.fn()

vi.mock('vue', () => ({
  createApp: vi.fn(() => ({
    use: useMock,
    mount: mountMock,
  })),
}))

vi.mock('pinia', () => ({
  createPinia: vi.fn(() => ({})),
}))

vi.mock('@/App.vue', () => ({ default: {} }))
vi.mock('@/router/index', () => ({ default: {} }))
vi.mock('../i18n', () => ({ default: {} }))
vi.mock('@/style.css', () => ({}))

const applyThemeMock = vi.fn()
vi.mock('@/theme/applyTheme', () => ({ applyTheme: (...a: unknown[]) => applyThemeMock(...a) }))

const authStoreMock = {
  setLtiUser: vi.fn(() => Promise.resolve()),
  setDevUser: vi.fn(() => Promise.resolve()),
  initialize: vi.fn(() => Promise.resolve()),
}

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => authStoreMock,
}))

/** Set what follows the path: ``?query``, ``#fragment`` or both. */
function setLocation(suffix: string) {
  window.history.replaceState({}, '', `/${suffix}`)
}

describe('main.ts boot dispatch', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    useMock.mockReset()
    setLocation('')
  })

  it('applies the theme before mounting the app', async () => {
    await import('../main')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(applyThemeMock).toHaveBeenCalledTimes(1)
    expect(applyThemeMock.mock.invocationCallOrder[0]).toBeLessThan(
      mountMock.mock.invocationCallOrder[0]!,
    )
  })

  it('boots into authenticated state from the LTI launch fragment', async () => {
    setLocation('#lti=1&email=teacher@dhbw.de&role=instructor&session_token=jwt-abc')

    await import('../main')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(authStoreMock.setLtiUser).toHaveBeenCalledWith('teacher@dhbw.de', 'jwt-abc', 'teacher')
    expect(authStoreMock.initialize).not.toHaveBeenCalled()
    expect(mountMock).toHaveBeenCalledWith('#app')
  })

  it('removes the LTI fragment before the router or anything else sees it', async () => {
    const hashAtUse: string[] = []
    useMock.mockImplementation(() => { hashAtUse.push(window.location.hash) })
    setLocation('#lti=1&email=student@dhbw.de&role=learner&session_token=jwt-abc')

    await import('../main')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(hashAtUse.length).toBeGreaterThan(0)
    expect(hashAtUse.every((h) => h === '')).toBe(true)
    expect(window.location.href).not.toContain('jwt-abc')
    expect(authStoreMock.setLtiUser).toHaveBeenCalledWith('student@dhbw.de', 'jwt-abc', 'student')
  })

  it('ignores LTI parameters in the query string (the token never travels there)', async () => {
    setLocation('?lti=1&email=teacher@dhbw.de&role=instructor&session_token=jwt-abc')

    await import('../main')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(authStoreMock.setLtiUser).not.toHaveBeenCalled()
    expect(authStoreMock.initialize).toHaveBeenCalled()
  })

  it('an incomplete LTI fragment is dropped and the normal login runs', async () => {
    setLocation('#lti=1&email=teacher@dhbw.de')

    await import('../main')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(window.location.hash).toBe('')
    expect(authStoreMock.setLtiUser).not.toHaveBeenCalled()
    expect(authStoreMock.initialize).toHaveBeenCalled()
  })

  it('ignores the removed self-service handoff parameters (.github#7 N)', async () => {
    setLocation('?handoff=1&email=student@dhbw.de&handoff_token=jwt-xyz')

    await import('../main')
    await new Promise((resolve) => setTimeout(resolve, 0))

    // No token from the URL is trusted: the normal Keycloak login runs.
    expect(authStoreMock.initialize).toHaveBeenCalled()
    expect(authStoreMock.setLtiUser).not.toHaveBeenCalled()
    expect(mountMock).toHaveBeenCalledWith('#app')
  })

  it('keeps the rest of the URL when removing the fragment', async () => {
    window.history.replaceState({}, '', '/apps?tab=mine#lti=1&email=a@dhbw.de&role=learner&session_token=jwt-abc')

    await import('../main')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(window.location.pathname).toBe('/apps')
    expect(window.location.search).toBe('?tab=mine')
    expect(window.location.hash).toBe('')
  })

  it('falls back to normal keycloak initialize when no lti params present', async () => {
    setLocation('')

    await import('../main')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(authStoreMock.initialize).toHaveBeenCalled()
    expect(authStoreMock.setLtiUser).not.toHaveBeenCalled()
  })
})
