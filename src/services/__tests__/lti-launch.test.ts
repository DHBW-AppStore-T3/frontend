import { describe, it, expect, beforeEach } from 'vitest'
import { takeLtiLaunch, mapLtiRole } from '../lti-launch'

const setUrl = (url: string) => window.history.replaceState({}, '', url)

describe('mapLtiRole', () => {
  it.each([
    ['instructor', 'teacher'],
    ['learner', 'student'],
    [null, 'student'],
  ])('%s -> %s', (role, expected) => {
    expect(mapLtiRole(role)).toBe(expected)
  })
})

describe('takeLtiLaunch', () => {
  beforeEach(() => setUrl('/'))

  it('reads email, token and role from the fragment and removes the fragment', () => {
    setUrl('/#lti=1&email=teacher@dhbw.de&role=instructor&session_token=jwt-abc')

    expect(takeLtiLaunch()).toEqual({ email: 'teacher@dhbw.de', token: 'jwt-abc', role: 'teacher' })
    expect(window.location.hash).toBe('')
    expect(window.location.href).not.toContain('jwt-abc')
  })

  it('keeps path and query when removing the fragment', () => {
    setUrl('/apps?tab=mine#lti=1&email=a@dhbw.de&role=learner&session_token=jwt-abc')

    expect(takeLtiLaunch()?.role).toBe('student')
    expect(window.location.pathname).toBe('/apps')
    expect(window.location.search).toBe('?tab=mine')
    expect(window.location.hash).toBe('')
  })

  it('ignores LTI parameters in the query string (the token never travels there)', () => {
    setUrl('/?lti=1&email=teacher@dhbw.de&role=instructor&session_token=jwt-abc')

    expect(takeLtiLaunch()).toBeNull()
    expect(window.location.search).toContain('session_token')
  })

  it('drops an incomplete fragment and launches nothing', () => {
    setUrl('/#lti=1&email=teacher@dhbw.de')

    expect(takeLtiLaunch()).toBeNull()
    expect(window.location.hash).toBe('')
  })

  it('leaves an unrelated fragment alone', () => {
    setUrl('/#section-2')

    expect(takeLtiLaunch()).toBeNull()
    expect(window.location.hash).toBe('#section-2')
  })
})
