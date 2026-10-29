import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseAppDetail } from '../appDetailGuard'

afterEach(() => vi.restoreAllMocks())

describe('parseAppDetail', () => {
  it('accepts a full answer and keeps unknown fields', () => {
    const raw = {
      appId: 'a1',
      name: 'Jupyter',
      is_private: false,
      deploy_version: 'v1',
      versions: ['v1', { version: 'v2' }],
      userId: 'u1',
      user: { username: 'ada' },
      somethingNew: 42,
    }
    expect(parseAppDetail(raw)).toEqual(raw)
  })

  it('accepts the minimal answer', () => {
    expect(parseAppDetail({ appId: 'a1', name: 'x' })).toEqual({ appId: 'a1', name: 'x' })
  })

  it.each([
    ['null', null],
    ['a string', 'app'],
    ['an array', [{ appId: 'a1', name: 'x' }]],
    ['no appId', { name: 'x' }],
    ['an empty appId', { appId: '', name: 'x' }],
    ['a numeric appId', { appId: 1, name: 'x' }],
    ['no name', { appId: 'a1' }],
    ['a name that is not a string', { appId: 'a1', name: { en: 'x' } }],
  ])('rejects %s', (_label, raw) => {
    expect(parseAppDetail(raw)).toBeNull()
  })

  it.each([
    ['versions', { versions: 'v1' }],
    ['versions', { versions: { v1: {} } }],
    ['deploy_version', { deploy_version: 3 }],
    ['is_private', { is_private: 'false' }],
    ['userId', { userId: 7 }],
    ['user', { user: 'ada' }],
    ['user', { user: ['ada'] }],
  ])('drops a wrong %s with a warning and keeps the rest', (key, extra) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = parseAppDetail({ appId: 'a1', name: 'x', ...extra })
    expect(result).toEqual({ appId: 'a1', name: 'x' })
    expect(result).not.toHaveProperty(key)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('accepts null for deploy_version and user', () => {
    const raw = { appId: 'a1', name: 'x', deploy_version: null, user: null }
    expect(parseAppDetail(raw)).toEqual(raw)
  })
})
