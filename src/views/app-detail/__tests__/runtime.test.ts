import { describe, it, expect } from 'vitest'
import { canStartDeployment, runtimeErrorKey, runtimeLabelKey, type DeployGate } from '../runtime'

const gate = (over: Partial<DeployGate> = {}): DeployGate => ({
  isStaff: true,
  version: 'v1',
  runtime: { runtime: 'kubernetes', scope: 'team' },
  ...over,
})
describe('canStartDeployment', () => {
  it('lets staff deploy a known pod version', () => {
    expect(canStartDeployment(gate())).toBe(true)
  })

  it.each([
    ['a student', { isStaff: false }],
    ['no version', { version: '' }],
    ['an unknown runtime (loading or invalid appstore.yaml)', { runtime: null }],
  ])('refuses %s', (_label, over) => {
    expect(canStartDeployment(gate(over))).toBe(false)
  })
})

describe('runtimeErrorKey', () => {
  it('names an invalid appstore.yaml', () => {
    expect(runtimeErrorKey({ response: { data: { detail: { reason: 'invalid_app_spec' } } } })).toBe(
      'AppsDetailView.runtime.invalidSpec',
    )
  })

  it.each(['appstore_yaml_missing', 'runtime_not_supported'])('names %s like an invalid spec', (reason) => {
    expect(runtimeErrorKey({ response: { data: { detail: { reason } } } })).toBe('AppsDetailView.runtime.invalidSpec')
  })

  it('treats everything else as a load error', () => {
    expect(runtimeErrorKey(new Error('x'))).toBe('AppsDetailView.runtime.loadError')
    expect(runtimeErrorKey({ response: { data: { detail: 'nope' } } })).toBe('AppsDetailView.runtime.loadError')
  })
})

describe('runtimeLabelKey', () => {
  it('always returns kubernetes label', () => {
    expect(runtimeLabelKey('kubernetes')).toBe('runtime.kubernetes')
  })
})
