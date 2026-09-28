import { describe, it, expect } from 'vitest'
import { formatUptime, pillToneClass } from '@/composables/useVmPresentation'

describe('formatUptime', () => {
  it('returns null for null input', () => {
    expect(formatUptime(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(formatUptime(undefined)).toBeNull()
  })

  it('returns null for invalid/unparseable string', () => {
    expect(formatUptime('not-a-date')).toBeNull()
  })

  it('returns null for future timestamp (negative delta)', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(formatUptime(future)).toBeNull()
  })

  it('formats delta < 60 minutes as "Nm"', () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60_000).toISOString()
    expect(formatUptime(thirtyMinutesAgo)).toBe('30m')
  })

  it('formats delta < 24 hours as "NhNm"', () => {
    const ninetyMinutesAgo = new Date(Date.now() - 90 * 60_000).toISOString()
    expect(formatUptime(ninetyMinutesAgo)).toBe('1h 30m')
  })

  it('formats delta ≥ 24 hours as "NdNh"', () => {
    // 25 hours = 1 day 1 hour
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60_000).toISOString()
    expect(formatUptime(twentyFiveHoursAgo)).toBe('1d 1h')
  })

  it('formats 48 hours exactly as "2d 0h"', () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60_000).toISOString()
    expect(formatUptime(twoDaysAgo)).toBe('2d 0h')
  })

  it('formats delta of exactly 0 minutes as "0m"', () => {
    const justNow = new Date(Date.now()).toISOString()
    // Allow 1s tolerance for test execution time
    const result = formatUptime(justNow)
    expect(result === '0m' || result === null).toBe(true)
  })
})

describe('pillToneClass', () => {
  it('green → emerald classes', () => {
    const cls = pillToneClass('green')
    expect(cls).toContain('emerald-100')
    expect(cls).toContain('emerald-700')
  })

  it('red → red classes', () => {
    const cls = pillToneClass('red')
    expect(cls).toContain('red-100')
    expect(cls).toContain('red-700')
  })

  it('amber → amber classes', () => {
    const cls = pillToneClass('amber')
    expect(cls).toContain('amber-100')
    expect(cls).toContain('amber-800')
  })

  it('grey → gray neutral classes', () => {
    const cls = pillToneClass('grey')
    expect(cls).toContain('gray-100')
    expect(cls).toContain('gray-700')
  })

  it('gray → gray neutral classes (alternative spelling)', () => {
    const cls = pillToneClass('gray')
    expect(cls).toContain('gray-100')
  })
})
