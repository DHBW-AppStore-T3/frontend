import { describe, it, expect } from 'vitest'
import { permissionsOf, allows, lifecycleGates } from '../access'

const detail = (over: Record<string, unknown> = {}) =>
  ({
    status: 'success',
    permissions: { owner_view: true, operate: true, member: false },
    actions: ['pause', 'destroy', 'redeploy'],
    ...over,
  }) as any

describe('permissionsOf', () => {
  it('takes what the API said, and grants nothing without it', () => {
    expect(permissionsOf(detail()).operate).toBe(true)
    expect(permissionsOf(null)).toEqual({ owner_view: false, operate: false, member: false })
    expect(permissionsOf({ status: 'success' } as any).owner_view).toBe(false)
  })
})

describe('allows', () => {
  it('needs the operate right and an action the lifecycle allows now', () => {
    expect(allows(detail(), 'pause')).toBe(true)
    expect(allows(detail(), 'resume')).toBe(false)
  })

  it('an admin who only sees a VM deployment cannot operate it', () => {
    const seeOnly = detail({ permissions: { owner_view: true, operate: false, member: false } })
    expect(allows(seeOnly, 'pause')).toBe(false)
    expect(lifecycleGates(seeOnly).canDelete).toBe(false)
  })
})

describe('lifecycleGates', () => {
  it('derives every button from the API', () => {
    expect(lifecycleGates(detail())).toMatchObject({
      canCancel: false,
      canDelete: true,
      canRedeploy: true,
      canPause: true,
      canResume: false,
      canPauseOrResume: true,
      pauseResumeAction: 'pause',
    })
  })

  it('delete is possible as destroy or as a straight delete', () => {
    expect(lifecycleGates(detail({ actions: ['delete'] })).canDelete).toBe(true)
    expect(lifecycleGates(detail({ actions: ['cancel'] })).canDelete).toBe(false)
    expect(lifecycleGates(detail({ actions: ['cancel'] })).canCancel).toBe(true)
  })

  it.each([
    ['success', ['pause', 'resume'], 'pause'],
    ['pause_failed', ['pause', 'resume'], 'pause'],
    ['redeploy_failed', ['pause'], 'pause'],
    ['paused', ['pause', 'resume'], 'resume'],
    ['resume_failed', ['pause', 'resume'], 'resume'],
  ])('in %s with %j the button does %s', (status, actions, expected) => {
    expect(lifecycleGates(detail({ status, actions })).pauseResumeAction).toBe(expected)
  })

  it('offers whatever is left when the state is unusual, and nothing otherwise', () => {
    expect(lifecycleGates(detail({ status: 'running', actions: ['resume'] })).pauseResumeAction).toBe('resume')
    expect(lifecycleGates(detail({ actions: [] })).pauseResumeAction).toBeNull()
    expect(lifecycleGates(detail({ actions: [] })).canPauseOrResume).toBe(false)
  })

  it('members never get lifecycle buttons', () => {
    const member = detail({ permissions: { owner_view: false, operate: false, member: true } })
    expect(lifecycleGates(member)).toMatchObject({ canCancel: false, canDelete: false, canPauseOrResume: false })
  })
})
