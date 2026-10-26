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

const redeem = vi.fn()
vi.mock('@/api/axios', () => ({ default: { post: (...a: unknown[]) => redeem(...a) } }))

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

  it('redeems the launch code and boots into the LTI session', async () => {
    redeem.mockResolvedValue({ data: { session_token: 'jwt-abc', email: 'teacher@dhbw.de', role: 'teacher' } })
    setLocation('#lti=1&code=one-time-abc')

    await boot()

    expect(redeem).toHaveBeenCalledWith('/lti13/session', { code: 'one-time-abc' }, { withCredentials: true })
    expect(authStoreMock.setLtiUser).toHaveBeenCalledWith('teacher@dhbw.de', 'jwt-abc', 'teacher')
    expect(authStoreMock.initialize).not.toHaveBeenCalled()
    expect(renderMock).toHaveBeenCalled()
  })

  it('falls back to the normal sign-in when the code is refused (reload, foreign link)', async () => {
    redeem.mockRejectedValue({ response: { status: 400 } })
    setLocation('#lti=1&code=used-up')

    await boot()

    expect(authStoreMock.setLtiUser).not.toHaveBeenCalled()
    expect(authStoreMock.initialize).toHaveBeenCalled()
  })

  it('does not trust a session token in the fragment', async () => {
    setLocation('#lti=1&email=teacher@dhbw.de&role=instructor&session_token=jwt-abc')

    await boot()

    expect(redeem).not.toHaveBeenCalled()
    expect(authStoreMock.setLtiUser).not.toHaveBeenCalled()
    expect(authStoreMock.initialize).toHaveBeenCalled()
  })

  it('removes the LTI fragment before the app is rendered', async () => {
    redeem.mockResolvedValue({ data: { session_token: 'jwt', email: 'a@dhbw.de', role: 'student' } })
    let hashAtRender: string | null = null
    renderMock.mockImplementationOnce(() => {
      hashAtRender = window.location.hash
    })
    setLocation('#lti=1&code=one-time-abc')

    await boot()

    expect(hashAtRender).toBe('')
    expect(window.location.href).not.toContain('one-time-abc')
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
