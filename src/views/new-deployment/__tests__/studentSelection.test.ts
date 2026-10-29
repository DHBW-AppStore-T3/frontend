import { describe, it, expect } from 'vitest'
import {
  displayNameOf,
  isCourseFullySelected,
  toggleCourseSelection,
  toggleId,
  deriveCourseIds,
  mergeIntoCache,
} from '../studentSelection'

const u = (keycloak_id: string, extra: Record<string, unknown> = {}) => ({ keycloak_id, userId: keycloak_id, ...extra }) as any

describe('displayNameOf', () => {
  it('prefers the full name, then username, email and id', () => {
    expect(displayNameOf(u('k', { firstName: 'Ada', lastName: 'Lovelace' }))).toBe('Ada Lovelace')
    expect(displayNameOf(u('k', { firstName: 'Ada' }))).toBe('Ada')
    expect(displayNameOf(u('k', { username: 'ada' }))).toBe('ada')
    expect(displayNameOf(u('k', { email: 'a@x.de' }))).toBe('a@x.de')
    expect(displayNameOf(u('k'))).toBe('k')
  })
})

describe('course selection', () => {
  it('is fully selected only when it has students and all of them are selected', () => {
    expect(isCourseFullySelected(['a', 'b'], ['a', 'b', 'c'])).toBe(true)
    expect(isCourseFullySelected(['a', 'b'], ['a'])).toBe(false)
    expect(isCourseFullySelected([], ['a'])).toBe(false)
  })

  it('selects all students without duplicates', () => {
    expect(toggleCourseSelection(['a', 'x'], ['a', 'b'])).toEqual(['a', 'x', 'b'])
  })

  it('deselects all students of a fully selected course', () => {
    expect(toggleCourseSelection(['a', 'b', 'x'], ['a', 'b'])).toEqual(['x'])
  })

  it('derives the selected course ids from loaded course members', () => {
    const members = new Map([
      ['c1', ['a', 'b']],
      ['c2', ['a', 'z']],
    ])
    expect(deriveCourseIds(['c1', 'c2', 'c3'], members, ['a', 'b'])).toEqual(['c1'])
  })
})

describe('toggleId', () => {
  it('adds and removes ids, ignoring blank ones', () => {
    expect(toggleId(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b'])
    expect(toggleId(['a'], '  ')).toEqual(['a'])
  })
})

describe('mergeIntoCache', () => {
  it('adds new students and only replaces entries with richer data', () => {
    const cache = new Map([['k1', u('k1')]])
    const next = mergeIntoCache(cache, [u('k1', { firstName: 'Ada' }), u('k2'), u('')])

    expect(next.get('k1')!.firstName).toBe('Ada')
    expect(next.has('k2')).toBe(true)
    expect(next.size).toBe(2)
    expect(next).not.toBe(cache)
  })

  it('keeps the existing entry when the new one adds nothing', () => {
    const existing = u('k1', { firstName: 'Ada', lastName: 'L' })
    const next = mergeIntoCache(new Map([['k1', existing]]), [u('k1')])
    expect(next.get('k1')).toBe(existing)
  })
})
