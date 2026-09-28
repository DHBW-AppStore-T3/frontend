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

describe('AuthService — localStorage degradation', () => {
  let originalSetItem: typeof Storage.prototype.setItem

  beforeEach(() => {
    originalSetItem = Storage.prototype.setItem
  })

  afterEach(() => {
    Storage.prototype.setItem = originalSetItem
  })

  it('degrades to in-memory when localStorage throws SecurityError', async () => {
    Storage.prototype.setItem = vi.fn(() => {
      throw new DOMException('Access denied', 'SecurityError')
    })

    const { AuthService } = await import('../auth.service')

    await expect(AuthService.fetchMe()).resolves.toMatchObject({ email: 'student@dhbw.de' })
  })
})
