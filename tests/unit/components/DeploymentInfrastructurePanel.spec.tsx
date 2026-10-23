import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import DeploymentInfrastructurePanel from '@/components/DeploymentInfrastructurePanel'

// When this panel was split out of DeploymentDetailView its three actions
// changed from direct calls on the view's own functions (`loadResources()`,
// `openVmDrawer`, `redeployVm`) into callbacks. A mis-wired callback is silent: the
// refresh button would simply do nothing. These tests pin the contract.

vi.mock('@/components/InfrastructureVmCard', () => ({
  default: (props: {
    resource: { address: string }
    redeploying: boolean
    isExpanded: boolean
    canRedeploy: boolean
    onOpenDetails: (a: string) => void
    onRedeploy: (a: string) => void
  }) => (
    <div
      className="vm-card"
      data-redeploying={String(props.redeploying)}
      data-expanded={String(props.isExpanded)}
      data-can-redeploy={String(props.canRedeploy)}
    >
      <button className="open" onClick={() => props.onOpenDetails(props.resource.address)} />
      <button className="redeploy" onClick={() => props.onRedeploy(props.resource.address)} />
    </div>
  ),
}))

const vm = (address: string) =>
  ({
    address,
    display_name: address,
    category: 'instance',
  }) as any

function renderPanel(over: Record<string, unknown> = {}) {
  const handlers = { onRefresh: vi.fn(), onOpenVm: vi.fn(), onRedeployVm: vi.fn() }
  const utils = render(
    <DeploymentInfrastructurePanel
      vmResources={[]}
      networkResources={[]}
      securityResources={[]}
      resourcesLoading={false}
      resourcesError={null}
      redeployInFlight={new Set<string>()}
      openDrawerAddress={null}
      {...handlers}
      {...over}
    />,
  )
  return { ...utils, ...handlers }
}

describe('DeploymentInfrastructurePanel', () => {
  it('asks the parent to refresh rather than loading anything itself', async () => {
    const { onRefresh } = renderPanel()

    await userEvent.click(screen.getByRole('button', { name: /Aktualisieren/ }))

    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('forwards a VM card open to the parent with the address', async () => {
    const { container, onOpenVm } = renderPanel({
      vmResources: [vm('openstack_compute_instance_v2.a')],
    })

    await userEvent.click(container.querySelector('.vm-card .open') as HTMLElement)

    expect(onOpenVm).toHaveBeenCalledWith('openstack_compute_instance_v2.a')
  })

  it('forwards a redeploy request to the parent with the address', async () => {
    const { container, onRedeployVm } = renderPanel({
      vmResources: [vm('openstack_compute_instance_v2.b')],
    })

    await userEvent.click(container.querySelector('.vm-card .redeploy') as HTMLElement)

    expect(onRedeployVm).toHaveBeenCalledWith('openstack_compute_instance_v2.b')
  })

  it('marks only the VM that has a redeploy in flight', () => {
    const { container } = renderPanel({
      vmResources: [vm('a'), vm('b')],
      redeployInFlight: new Set(['b']),
    })

    const cards = [...container.querySelectorAll('.vm-card')]
    expect(cards.map((c) => c.getAttribute('data-redeploying'))).toEqual(['false', 'true'])
  })

  it('lets the cards redeploy unless the caller may not', () => {
    const allowed = renderPanel({ vmResources: [vm('a')] })
    expect(allowed.container.querySelector('.vm-card')?.getAttribute('data-can-redeploy')).toBe('true')
    allowed.unmount()

    const denied = renderPanel({ vmResources: [vm('a')], canRedeploy: false })
    expect(denied.container.querySelector('.vm-card')?.getAttribute('data-can-redeploy')).toBe('false')
  })

  it('marks only the VM whose drawer is open', () => {
    const { container } = renderPanel({
      vmResources: [vm('a'), vm('b')],
      openDrawerAddress: 'a',
    })

    const cards = [...container.querySelectorAll('.vm-card')]
    expect(cards.map((c) => c.getAttribute('data-expanded'))).toEqual(['true', 'false'])
  })

  it('disables the refresh button while a load is in flight', () => {
    renderPanel({ resourcesLoading: true })

    expect(screen.getByRole('button', { name: /Aktualisieren/ })).toBeDisabled()
  })

  it('shows the error text when the resource load failed', () => {
    renderPanel({ resourcesError: 'boom from openstack' })

    expect(screen.getByText('boom from openstack')).toBeInTheDocument()
  })

  it('shows loading and empty states for VMs', () => {
    const { unmount } = renderPanel({ resourcesLoading: true })
    expect(screen.getByText('Lade VMs…')).toBeInTheDocument()
    unmount()

    renderPanel()
    expect(screen.getByText('Keine VMs im aktuellen Terraform-State.')).toBeInTheDocument()
  })

  it('renders network and security-group entries', () => {
    renderPanel({
      networkResources: [{ address: 'net.a', display_name: 'private-net', category: 'network' } as any],
      securityResources: [{ address: 'sg.a', display_name: 'default-sg' } as any],
    })

    expect(screen.getByText('private-net')).toBeInTheDocument()
    expect(screen.getByText('default-sg')).toBeInTheDocument()
  })
})
