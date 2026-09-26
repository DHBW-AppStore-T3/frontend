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
  setHandoffUser: vi.fn(() => Promise.resolve()),
  setDevUser: vi.fn(() => Promise.resolve()),
  initialize: vi.fn(() => Promise.resolve()),
}

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => authStoreMock,
}))

function setLocation(search: string) {
  window.history.replaceState({}, '', `/${search}`)
}

describe('main.ts boot dispatch', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
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

  it('boots into authenticated state when lti query params present', async () => {
    setLocation('?lti=1&email=teacher@dhbw.de&name=Teacher&role=instructor&course=Math&courseId=1&session_token=jwt-abc')

    await import('../main')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(authStoreMock.setLtiUser).toHaveBeenCalledWith('teacher@dhbw.de', 'jwt-abc', 'teacher')
    expect(mountMock).toHaveBeenCalledWith('#app')
  })

  it('boots authenticated via handoff query params', async () => {
    setLocation('?handoff=1&email=student@dhbw.de&handoff_token=jwt-xyz')

    await import('../main')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(authStoreMock.setHandoffUser).toHaveBeenCalledWith('student@dhbw.de', 'jwt-xyz')
    expect(mountMock).toHaveBeenCalledWith('#app')
  })

  it('strips lti/handoff query params after processing', async () => {
    setLocation('?lti=1&email=teacher@dhbw.de&role=instructor&session_token=jwt-abc')

    await import('../main')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(window.location.search).toBe('')
  })

  it('falls back to normal keycloak initialize when no lti/handoff params present', async () => {
    setLocation('')

    await import('../main')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(authStoreMock.initialize).toHaveBeenCalled()
    expect(authStoreMock.setLtiUser).not.toHaveBeenCalled()
    expect(authStoreMock.setHandoffUser).not.toHaveBeenCalled()
  })
})
