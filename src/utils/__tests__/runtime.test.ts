import { describe, expect, it } from 'vitest'
import { canRestartWorkloads, confirmMessageSuffix, isClusterRuntime, runtimeLabelKey } from '../runtime'

describe('isClusterRuntime', () => {
  it('pods and KubeVirt VMs live in the cluster, OpenStack VMs do not', () => {
    expect(isClusterRuntime('kubernetes')).toBe(true)
    expect(isClusterRuntime('kubevirt-vm')).toBe(true)
    expect(isClusterRuntime('openstack-vm')).toBe(false)
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
    expect(runtimeLabelKey('openstack-vm', 'short')).toBe('runtime.openstackVmShort')
  })
})

describe('confirmMessageSuffix', () => {
  it('names pods, a KubeVirt VM and (none) an OpenStack VM differently', () => {
    expect(confirmMessageSuffix('kubernetes')).toBe('Pods')
    expect(confirmMessageSuffix('kubevirt-vm')).toBe('Vm')
    expect(confirmMessageSuffix('openstack-vm')).toBe('')
    expect(confirmMessageSuffix(null)).toBe('')
  })
})

describe('canRestartWorkloads', () => {
  it('is a pod-only operation', () => {
    expect(canRestartWorkloads('kubernetes')).toBe(true)
    expect(canRestartWorkloads('kubevirt-vm')).toBe(false)
    expect(canRestartWorkloads('openstack-vm')).toBe(false)
    expect(canRestartWorkloads(undefined)).toBe(false)
  })
})
