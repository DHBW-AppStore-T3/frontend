import { describe, it, expect, beforeEach, vi } from 'vitest'

const post = vi.hoisted(() => vi.fn())
vi.mock('@/api/axios', () => ({ default: { post } }))

import { redeemLtiCode, takeLtiLaunch } from '../lti-launch'

const setUrl = (url: string) => window.history.replaceState({}, '', url)

describe('takeLtiLaunch', () => {
  beforeEach(() => setUrl('/'))

  it('reads the one-time code from the fragment and removes the fragment', () => {
    setUrl('/#lti=1&code=one-time-abc')

    expect(takeLtiLaunch()).toBe('one-time-abc')
    expect(window.location.hash).toBe('')
    expect(window.location.href).not.toContain('one-time-abc')
  })

  it('keeps path and query when removing the fragment', () => {
    setUrl('/apps?tab=mine#lti=1&code=abc')

    expect(takeLtiLaunch()).toBe('abc')
    expect(window.location.pathname).toBe('/apps')
    expect(window.location.search).toBe('?tab=mine')
    expect(window.location.hash).toBe('')
  })

  it('no longer accepts a session token in the fragment (a crafted link signed the visitor in as someone else)', () => {
    setUrl('/#lti=1&email=teacher@dhbw.de&role=instructor&session_token=jwt-abc')

    expect(takeLtiLaunch()).toBeNull()
    expect(window.location.href).not.toContain('jwt-abc')
  })

  it('ignores LTI parameters in the query string', () => {
    setUrl('/?lti=1&code=abc')

    expect(takeLtiLaunch()).toBeNull()
    expect(window.location.search).toContain('code')
  })

  it('leaves an unrelated fragment alone', () => {
    setUrl('/#section-2')

    expect(takeLtiLaunch()).toBeNull()
    expect(window.location.hash).toBe('#section-2')
  })
})

describe('redeemLtiCode', () => {
  beforeEach(() => {
    post.mockReset()
  })

  it('trades the code, with the binding cookie, for the session', async () => {
    post.mockResolvedValue({ data: { session_token: 'jwt-1', email: 'teacher@dhbw.de', role: 'teacher' } })

    await expect(redeemLtiCode('abc')).resolves.toEqual({ email: 'teacher@dhbw.de', token: 'jwt-1', role: 'teacher' })
    expect(post).toHaveBeenCalledWith('/lti13/session', { code: 'abc' }, { withCredentials: true })
  })

  it('fails when the API refuses the code', async () => {
    post.mockRejectedValue(new Error('Request failed with status code 400'))

    await expect(redeemLtiCode('abc')).rejects.toThrow('400')
  })
})
