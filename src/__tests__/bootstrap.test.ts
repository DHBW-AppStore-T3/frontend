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
  setHandoffUser: vi.fn(() => Promise.resolve()),
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

  it('boots into authenticated state when lti query params present', async () => {
    setLocation('?lti=1&email=teacher@dhbw.de&name=Teacher&role=instructor&course=Math&courseId=1&session_token=jwt-abc')

    await boot()

    expect(authStoreMock.setLtiUser).toHaveBeenCalledWith('teacher@dhbw.de', 'jwt-abc', 'teacher')
    expect(renderMock).toHaveBeenCalled()
  })

  it('maps a non-instructor LTI role to student', async () => {
    setLocation('?lti=1&email=s@dhbw.de&role=learner&session_token=jwt')

    await boot()

    expect(authStoreMock.setLtiUser).toHaveBeenCalledWith('s@dhbw.de', 'jwt', 'student')
  })

  it('boots authenticated via handoff query params', async () => {
    setLocation('?handoff=1&email=student@dhbw.de&handoff_token=jwt-xyz')

    await boot()

    expect(authStoreMock.setHandoffUser).toHaveBeenCalledWith('student@dhbw.de', 'jwt-xyz')
    expect(renderMock).toHaveBeenCalled()
  })

  it('strips lti/handoff query params after processing', async () => {
    setLocation('?lti=1&email=teacher@dhbw.de&role=instructor&session_token=jwt-abc')

    await boot()

    expect(window.location.search).toBe('')
  })

  it('strips handoff params too', async () => {
    setLocation('?handoff=1&email=s@dhbw.de&handoff_token=t&keep=1')

    await boot()

    expect(window.location.search).toBe('?keep=1')
  })

  it('falls back to normal keycloak initialize when no lti/handoff params present', async () => {
    await boot()

    expect(authStoreMock.initialize).toHaveBeenCalled()
    expect(authStoreMock.setLtiUser).not.toHaveBeenCalled()
    expect(authStoreMock.setHandoffUser).not.toHaveBeenCalled()
  })

  it('uses the dev SSO bridge when ?sso_handoff is present (DEV only)', async () => {
    setLocation('?sso_handoff=dev%40dhbw.de')

    await boot()

    expect(authStoreMock.setDevUser).toHaveBeenCalledWith('dev@dhbw.de')
    expect(window.location.search).toBe('')
  })
})
