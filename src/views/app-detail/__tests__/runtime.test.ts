import { describe, it, expect } from 'vitest'
import { needsCredential, canStartDeployment, runtimeErrorKey, runtimeLabelKey, type DeployGate } from '../runtime'

const gate = (over: Partial<DeployGate> = {}): DeployGate => ({
  isStaff: true,
  version: 'v1',
  runtime: { runtime: 'kubernetes', scope: 'team' },
  credentialsResolved: true,
  hasUsableCredential: false,
  ...over,
})
const vm = { runtime: 'openstack-vm' as const, scope: 'user' as const }

describe('needsCredential', () => {
  it('a pod version needs none', () => {
    expect(needsCredential(gate())).toBe(false)
  })

  it('a VM version needs a usable one, once the credentials are known', () => {
    expect(needsCredential(gate({ runtime: vm }))).toBe(true)
    expect(needsCredential(gate({ runtime: vm, hasUsableCredential: true }))).toBe(false)
    expect(needsCredential(gate({ runtime: vm, credentialsResolved: false }))).toBe(false)
  })

  it('is false while the runtime is unknown', () => {
    expect(needsCredential(gate({ runtime: null }))).toBe(false)
  })
})

describe('canStartDeployment', () => {
  it('lets staff deploy a known pod version without a credential', () => {
    expect(canStartDeployment(gate())).toBe(true)
  })

  it.each([
    ['a student', { isStaff: false }],
    ['no version', { version: '' }],
    ['an unknown runtime (loading or invalid appstore.yaml)', { runtime: null }],
    ['a VM version without a usable credential', { runtime: vm }],
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

  it('treats everything else as a load error', () => {
    expect(runtimeErrorKey(new Error('x'))).toBe('AppsDetailView.runtime.loadError')
    expect(runtimeErrorKey({ response: { data: { detail: 'nope' } } })).toBe('AppsDetailView.runtime.loadError')
  })
})

describe('runtimeLabelKey', () => {
  it('maps both runtimes', () => {
    expect(runtimeLabelKey('kubernetes')).toBe('runtime.kubernetes')
    expect(runtimeLabelKey('openstack-vm')).toBe('runtime.openstackVm')
  })
})
