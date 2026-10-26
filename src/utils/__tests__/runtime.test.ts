import { describe, expect, it } from 'vitest'
import { isClusterRuntime, runtimeLabelKey } from '../runtime'

describe('isClusterRuntime', () => {
  it('pods and KubeVirt VMs live in the cluster', () => {
    expect(isClusterRuntime('kubernetes')).toBe(true)
    expect(isClusterRuntime('kubevirt-vm')).toBe(true)
  })

  it('an unknown runtime is not assumed to be a cluster one', () => {
    expect(isClusterRuntime(null)).toBe(false)
    expect(isClusterRuntime(undefined)).toBe(false)
  })
})

describe('runtimeLabelKey', () => {
  it('names every runtime in the long and the short form', () => {
    expect(runtimeLabelKey('kubernetes')).toBe('runtime.kubernetes')
    expect(runtimeLabelKey('kubevirt-vm')).toBe('runtime.kubevirtVm')
    expect(runtimeLabelKey('kubevirt-vm', 'short')).toBe('runtime.kubevirtVmShort')
    expect(runtimeLabelKey(null)).toBe('runtime.kubernetes')
  })
})
