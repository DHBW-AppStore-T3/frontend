import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import DeploymentInfrastructurePanel from '@/components/DeploymentInfrastructurePanel.vue'

// When this panel was split out of DeploymentDetailView.vue its three actions
// changed from direct calls on the view's own functions (`loadResources()`,
// `openVmDrawer`, `redeployVm`) into emits. A mis-wired emit is silent: the
// refresh button would simply do nothing. These tests pin the contract.

vi.mock('@/components/InfrastructureVmCard.vue', () => ({
  default: {
    name: 'InfrastructureVmCard',
    props: ['resource', 'redeploying', 'isExpanded'],
    emits: ['open-details', 'redeploy'],
    template:
      '<div class="vm-card">' +
      '<button class="open" @click="$emit(\'open-details\', resource.address)" />' +
      '<button class="redeploy" @click="$emit(\'redeploy\', resource.address)" />' +
      '</div>',
  },
}))

const vm = (address: string) => ({
  address,
  display_name: address,
  category: 'instance',
}) as any

const mountPanel = (over: Record<string, unknown> = {}) =>
  mount(DeploymentInfrastructurePanel, {
    props: {
      vmResources: [],
      networkResources: [],
      securityResources: [],
      resourcesLoading: false,
      resourcesError: null,
      redeployInFlight: new Set<string>(),
      openDrawerAddress: null,
      ...over,
    },
  })

describe('DeploymentInfrastructurePanel', () => {
  it('asks the parent to refresh rather than loading anything itself', async () => {
    const wrapper = mountPanel()

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })

  it('forwards a VM card open to the parent with the address', async () => {
    const wrapper = mountPanel({ vmResources: [vm('openstack_compute_instance_v2.a')] })

    await wrapper.find('.vm-card .open').trigger('click')

    expect(wrapper.emitted('open-vm')?.[0]).toEqual(['openstack_compute_instance_v2.a'])
  })

  it('forwards a redeploy request to the parent with the address', async () => {
    const wrapper = mountPanel({ vmResources: [vm('openstack_compute_instance_v2.b')] })

    await wrapper.find('.vm-card .redeploy').trigger('click')

    expect(wrapper.emitted('redeploy-vm')?.[0]).toEqual(['openstack_compute_instance_v2.b'])
  })

  it('marks only the VM that has a redeploy in flight', () => {
    const wrapper = mountPanel({
      vmResources: [vm('a'), vm('b')],
      redeployInFlight: new Set(['b']),
    })

    const cards = wrapper.findAllComponents({ name: 'InfrastructureVmCard' })
    expect(cards.map((c) => c.props('redeploying'))).toEqual([false, true])
  })

  it('marks only the VM whose drawer is open', () => {
    const wrapper = mountPanel({
      vmResources: [vm('a'), vm('b')],
      openDrawerAddress: 'a',
    })

    const cards = wrapper.findAllComponents({ name: 'InfrastructureVmCard' })
    expect(cards.map((c) => c.props('isExpanded'))).toEqual([true, false])
  })

  it('disables the refresh button while a load is in flight', () => {
    const wrapper = mountPanel({ resourcesLoading: true })

    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('shows the error text when the resource load failed', () => {
    const wrapper = mountPanel({ resourcesError: 'boom from openstack' })

    expect(wrapper.text()).toContain('boom from openstack')
  })

  it('renders network and security-group entries', () => {
    const wrapper = mountPanel({
      networkResources: [{ address: 'net.a', display_name: 'private-net' } as any],
      securityResources: [{ address: 'sg.a', display_name: 'default-sg' } as any],
    })

    expect(wrapper.text()).toContain('private-net')
    expect(wrapper.text()).toContain('default-sg')
  })
})
