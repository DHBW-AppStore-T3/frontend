import { describe, it, expect } from 'vitest'
import { safeReturnUrl } from '../return-url'

const BACKSLASH = String.fromCharCode(92)

describe('safeReturnUrl', () => {
  it.each(['/', '/apps', '/apps/42?tab=logs#top', '/deployment/new/variables'])('keeps the app path %s', (path) => {
    expect(safeReturnUrl(path)).toBe(path)
  })

  it.each([
    ['another origin', 'https://evil.example/phish'],
    ['a protocol-relative URL', '//evil.example'],
    ['a backslash host', '/' + BACKSLASH + 'evil.example'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['a relative path', 'apps'],
    ['a tab that browsers drop', '/\t/evil.example'],
    ['a newline', '/apps\n/evil'],
    ['an empty string', ''],
    ['null', null],
    ['a number', 5],
  ])('falls back for %s', (_label, raw) => {
    expect(safeReturnUrl(raw)).toBe('/')
    expect(safeReturnUrl(raw, '/dashboard')).toBe('/dashboard')
  })
})
