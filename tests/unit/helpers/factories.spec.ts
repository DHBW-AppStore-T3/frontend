import { describe, it, expect } from 'vitest'
import { makeTask, makeUser } from '../../helpers/factories'

describe('fixture factories', () => {
  it('makeUser gives a complete student and lets a spec override fields', () => {
    expect(makeUser()).toMatchObject({ userId: 'user-1', role: 'student' })
    expect(makeUser({ role: 'admin', username: 'root' })).toMatchObject({ role: 'admin', username: 'root' })
  })

  it('makeTask gives a successful deploy task and lets a spec override fields', () => {
    expect(makeTask()).toMatchObject({ type: 'deploy', status: 'success' })
    expect(makeTask({ status: 'failed', logs: 'boom' })).toMatchObject({ status: 'failed', logs: 'boom' })
  })

  it('returns a new object every time', () => {
    expect(makeTask()).not.toBe(makeTask())
  })
})
