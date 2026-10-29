import { describe, it, expect, beforeEach } from 'vitest'
import { AuthService } from '../auth.service'

// The cached profile is parsed from localStorage; anything that is not a user
// object must be ignored (issue 147).
describe('AuthService.getStoredUser', () => {
  beforeEach(() => localStorage.clear())

  it('returns a stored user', () => {
    localStorage.setItem('user', JSON.stringify({ userId: 'u1', role: 'teacher', email: 'a@b.de' }))
    expect(AuthService.getStoredUser()).toMatchObject({ userId: 'u1', role: 'teacher' })
  })

  it.each([
    ['a number', '5'],
    ['null', 'null'],
    ['a string', '"admin"'],
    ['an array', '[{"userId":"u1","role":"admin"}]'],
    ['an object without a role', '{"userId":"u1"}'],
    ['an object without a user id', '{"role":"admin"}'],
    ['a role that is not a string', '{"userId":"u1","role":1}'],
    ['broken JSON', '{nope'],
  ])('ignores %s', (_label, raw) => {
    localStorage.setItem('user', raw)
    expect(AuthService.getStoredUser()).toBeNull()
  })

  it('returns null when nothing is stored', () => {
    expect(AuthService.getStoredUser()).toBeNull()
  })
})
