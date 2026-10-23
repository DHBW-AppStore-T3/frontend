import { describe, it, expect, vi, beforeEach } from 'vitest'

const renderMock = vi.fn()
const createRootMock = vi.fn(() => ({ render: renderMock }))

vi.mock('react-dom/client', () => ({ createRoot: createRootMock }))
vi.mock('@/App', () => ({ default: () => null }))
vi.mock('@/style.css', () => ({}))

const applyThemeMock = vi.fn()
vi.mock('@/theme/applyTheme', () => ({ applyTheme: (...a: unknown[]) => applyThemeMock(...a) }))

const authStoreMock = {
  setLtiUser: vi.fn(() => Promise.resolve()),
  setDevUser: vi.fn(() => Promise.resolve()),
  initialize: vi.fn(() => Promise.resolve()),
}

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: { getState: () => authStoreMock },
}))

function setLocation(search: string) {
  window.history.replaceState({}, '', `/${search}`)
}

async function boot() {
  const { bootstrap } = await import('../bootstrap')
  await bootstrap()
}

describe('bootstrap dispatch', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    setLocation('')
    document.body.innerHTML = '<div id="root"></div>'
  })

  it('applies the theme before rendering the app', async () => {
    await boot()

    expect(applyThemeMock).toHaveBeenCalledTimes(1)
    expect(applyThemeMock.mock.invocationCallOrder[0]).toBeLessThan(
      renderMock.mock.invocationCallOrder[0]!,
    )
  })

  it('mounts into #root', async () => {
    await boot()

    expect(createRootMock).toHaveBeenCalledWith(document.getElementById('root'))
    expect(renderMock).toHaveBeenCalledTimes(1)
  })

  it('boots into authenticated state from the LTI launch fragment', async () => {
    setLocation('#lti=1&email=teacher@dhbw.de&role=instructor&session_token=jwt-abc')

    await boot()

    expect(authStoreMock.setLtiUser).toHaveBeenCalledWith('teacher@dhbw.de', 'jwt-abc', 'teacher')
    expect(authStoreMock.initialize).not.toHaveBeenCalled()
    expect(renderMock).toHaveBeenCalled()
  })

  it('maps a non-instructor LTI role to student', async () => {
    setLocation('#lti=1&email=s@dhbw.de&role=learner&session_token=jwt')

    await boot()

    expect(authStoreMock.setLtiUser).toHaveBeenCalledWith('s@dhbw.de', 'jwt', 'student')
  })

  it('removes the LTI fragment before the app is rendered', async () => {
    let hashAtRender: string | null = null
    renderMock.mockImplementationOnce(() => {
      hashAtRender = window.location.hash
    })
    setLocation('#lti=1&email=a@dhbw.de&role=learner&session_token=jwt-abc')

    await boot()

    expect(hashAtRender).toBe('')
    expect(window.location.href).not.toContain('jwt-abc')
  })

  it('ignores LTI parameters in the query string (the token never travels there)', async () => {
    setLocation('?lti=1&email=teacher@dhbw.de&role=instructor&session_token=jwt-abc')

    await boot()

    expect(authStoreMock.setLtiUser).not.toHaveBeenCalled()
    expect(authStoreMock.initialize).toHaveBeenCalled()
  })

  it('ignores the removed self-service handoff parameters (.github#7 N)', async () => {
    setLocation('?handoff=1&email=student@dhbw.de&handoff_token=jwt-xyz')

    await boot()

    // No token from the URL is trusted: the normal Keycloak login runs.
    expect(authStoreMock.initialize).toHaveBeenCalled()
    expect(authStoreMock.setLtiUser).not.toHaveBeenCalled()
  })

  it('falls back to normal keycloak initialize when no LTI fragment is present', async () => {
    await boot()

    expect(authStoreMock.initialize).toHaveBeenCalled()
    expect(authStoreMock.setLtiUser).not.toHaveBeenCalled()
  })

  it('uses the dev SSO bridge when ?sso_handoff is present (DEV only)', async () => {
    setLocation('?sso_handoff=dev%40dhbw.de')

    await boot()

    expect(authStoreMock.setDevUser).toHaveBeenCalledWith('dev@dhbw.de')
    expect(window.location.search).toBe('')
  })
})
