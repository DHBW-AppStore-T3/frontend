import { describe, it, expect } from 'vitest'
import { greetingNameOf } from '../user-display'

describe('greetingNameOf', () => {
  it('prefers the first name, as stored', () => {
    expect(greetingNameOf({ firstName: 'Dozentin', username: 'dozent.demo' })).toBe('Dozentin')
  })

  it('trims the first name', () => {
    expect(greetingNameOf({ firstName: '  Anna ', username: 'a' })).toBe('Anna')
  })

  it('falls back to the capitalised username for a blank first name', () => {
    expect(greetingNameOf({ firstName: '  ', username: 'dozent.demo' })).toBe('Dozent.demo')
  })

  it('falls back to the capitalised username for a missing first name', () => {
    expect(greetingNameOf({ firstName: null, username: 'maximilian' })).toBe('Maximilian')
    expect(greetingNameOf({ username: 'maximilian' })).toBe('Maximilian')
  })

  it('returns an empty string without a user', () => {
    expect(greetingNameOf(null)).toBe('')
    expect(greetingNameOf(undefined)).toBe('')
  })
})
