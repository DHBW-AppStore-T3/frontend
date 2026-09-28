import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/api/user.api', () => ({
  userApi: {
    getMe: vi.fn(() =>
      Promise.resolve({
        data: {
          userId: 'u1',
          email: 'student@dhbw.de',
          username: 'student',
          role: 'student',
          courseId: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      })
    ),
  },
}))

import { AuthService } from '../auth.service'

// ---------------------------------------------------------------------------
// Use vi.stubGlobal('localStorage', ...) so the tests work regardless of
// whether happy-dom routes calls through Storage.prototype or its own object.
// ---------------------------------------------------------------------------
describe('AuthService — normal operation', () => {
  const fakeStore: Record<string, string> = {}
  const localStorageMock = {
    getItem: vi.fn((key: string) => fakeStore[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { fakeStore[key] = value }),
    removeItem: vi.fn((key: string) => { delete fakeStore[key] }),
  }

  beforeEach(() => {
    Object.keys(fakeStore).forEach(k => delete fakeStore[k])
    vi.clearAllMocks()
    vi.stubGlobal('localStorage', localStorageMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetchMe: calls userApi.getMe and returns the user', async () => {
    const user = await AuthService.fetchMe()
    expect(user.email).toBe('student@dhbw.de')
    expect(user.role).toBe('student')
  })

  it('fetchMe: persists user JSON to localStorage under "user" key', async () => {
    await AuthService.fetchMe()
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'user',
      expect.stringContaining('student@dhbw.de'),
    )
  })

  it('getStoredUser: returns null when localStorage has no "user" key', () => {
    expect(AuthService.getStoredUser()).toBeNull()
  })

  it('getStoredUser: parses and returns the stored user', async () => {
    await AuthService.fetchMe()           // writes JSON into fakeStore['user']
    const user = AuthService.getStoredUser()
    expect(user).not.toBeNull()
    expect(user!.email).toBe('student@dhbw.de')
  })

  it('getStoredUser: returns null for invalid JSON', () => {
    fakeStore['user'] = '{invalid-json{{'
    expect(AuthService.getStoredUser()).toBeNull()
  })

  it('clearStoredUser: removes the "user" key from localStorage', async () => {
    await AuthService.fetchMe()
    expect(AuthService.getStoredUser()).not.toBeNull()
    AuthService.clearStoredUser()
    expect(AuthService.getStoredUser()).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Degradation: when storage throws the service must not crash.
// Use a stubGlobal that throws so we don't depend on Storage.prototype routing.
// ---------------------------------------------------------------------------
describe('AuthService — localStorage degradation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetchMe does not throw when setItem throws SecurityError', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => { throw new DOMException('Access denied', 'SecurityError') }),
      removeItem: vi.fn(),
    })
    await expect(AuthService.fetchMe()).resolves.toMatchObject({ email: 'student@dhbw.de' })
  })

  it('getStoredUser returns null when getItem throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => { throw new DOMException('Access denied', 'SecurityError') }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
    expect(AuthService.getStoredUser()).toBeNull()
  })

  it('clearStoredUser does not throw when removeItem throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(() => { throw new DOMException('Access denied', 'SecurityError') }),
    })
    expect(() => AuthService.clearStoredUser()).not.toThrow()
  })
})
