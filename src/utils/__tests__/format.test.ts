import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime, formatBytes } from '@/utils/format'

describe('formatDate', () => {
  it('formats an ISO date string in de-DE locale', () => {
    // Node.js ICU may omit leading zeros; check year and separator instead.
    const result = formatDate('2026-06-08')
    expect(result).toMatch(/\d+\.\d+\.2026/)
    expect(result).toContain('2026')
  })

  it('formats a Date instance in de-DE locale', () => {
    const d = new Date(2026, 5, 8) // month is 0-indexed
    const result = formatDate(d)
    expect(result).toMatch(/\d+\.\d+\.2026/)
  })

  it('returns the stringified value for an invalid Date instance', () => {
    const bad = new Date('not-a-date')
    expect(formatDate(bad)).toBe(String(bad))
  })

  it('returns the input string verbatim when it is not a parseable date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })

  it('returns undefined when called with no argument', () => {
    expect(formatDate()).toBeUndefined()
  })

  it('returns null when called with null', () => {
    expect(formatDate(null)).toBeNull()
  })
})

describe('formatDateTime', () => {
  it('formats an ISO datetime string with date and time', () => {
    const result = formatDateTime('2026-06-08T15:30:00Z')
    expect(result).toContain('08.06.2026')
  })

  it('returns "-" for null', () => {
    expect(formatDateTime(null)).toBe('-')
  })

  it('returns "-" for undefined', () => {
    expect(formatDateTime(undefined)).toBe('-')
  })

  it('returns "-" for an empty string', () => {
    expect(formatDateTime('')).toBe('-')
  })

  it('accepts a numeric timestamp', () => {
    const result = formatDateTime(0)
    expect(result).toContain('1970')
  })

  it('accepts a Date instance', () => {
    const result = formatDateTime(new Date(2026, 5, 8, 15, 30, 0))
    expect(result).toContain('08.06.2026')
  })
})

describe('formatBytes', () => {
  it('formats bytes under 1 KB as "n B"', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1023)).toBe('1023 B')
  })

  it('formats values in the KB range', () => {
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(1536)).toBe('2 KB') // rounds 1.5 → 2
  })

  it('formats values in the MB range with one decimal', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB')
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB')
  })
})
