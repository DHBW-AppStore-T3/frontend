import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InfrastructureVmCard from '@/components/InfrastructureVmCard'
import { renderWithProviders } from '../../helpers/render'

const make = (over: Record<string, unknown> = {}) =>
  ({
    address: 'openstack_compute_instance_v2.web',
    display_name: 'web-1',
    category: 'instance',
    team: 'Team-A',
    drift: 'in_sync',
    lifecycle: { status: 'ACTIVE', task_state: null },
    hardware: {
      flavor_name: 'm1.small',
      vcpus: 2,
      ram_mb: 2048,
      disk_gb: 20,
      image_name: 'ubuntu',
      availability_zone: 'nova',
      launched_at: null,
    },
    addresses: [{ network: 'private', fixed_ip: '10.0.0.5', floating_ip: '1.2.3.4' }],
    ...over,
  }) as any

function renderCard(resource = make(), props: Record<string, unknown> = {}) {
  const handlers = { onOpenDetails: vi.fn(), onRedeploy: vi.fn() }
  const utils = renderWithProviders(
    <InfrastructureVmCard resource={resource} {...handlers} {...props} />,
  )
  return { ...utils, ...handlers }
}

describe('InfrastructureVmCard', () => {
  it('shows name, team badge and an ACTIVE lifecycle pill in the green tone', () => {
    renderCard()
    expect(screen.getByText('web-1')).toBeInTheDocument()
    expect(screen.getByText('Team-A')).toBeInTheDocument()
    expect(screen.getByText('ACTIVE')).toHaveClass('bg-emerald-100')
  })

  it('falls back to the shared-team label when there is no team', () => {
    renderCard(make({ team: null }))
    expect(screen.getByText('vm.sharedTeam')).toBeInTheDocument()
  })

  it('combines status and task_state in the pill and picks amber for BUILD', () => {
    renderCard(make({ lifecycle: { status: 'BUILD', task_state: 'networking' } }))
    expect(screen.getByText('BUILD · networking')).toHaveClass('bg-amber-100')
  })

  it('uses the red tone for ERROR and shows the fault message', () => {
    renderCard(make({ lifecycle: { status: 'ERROR', fault_message: 'no valid host' } }))
    expect(screen.getByText('ERROR')).toHaveClass('bg-red-100')
    expect(screen.getByText('vm.openstackFault')).toBeInTheDocument()
    expect(screen.getByText('no valid host')).toBeInTheDocument()
  })

  it('renders "unknown" without lifecycle data', () => {
    renderCard(make({ lifecycle: undefined }))
    expect(screen.getByText('unknown')).toBeInTheDocument()
  })

  it('renders a compact hardware summary and addresses', () => {
    renderCard()
    expect(
      screen.getByText('m1.small · 2 vm.units.vcpu · 2 vm.units.gb RAM · 20 vm.units.gb'),
    ).toBeInTheDocument()
    expect(screen.getByText('Image: ubuntu')).toBeInTheDocument()
    expect(screen.getByText('AZ: nova')).toBeInTheDocument()
    expect(screen.getByText('10.0.0.5')).toBeInTheDocument()
    expect(screen.getByText('→ 1.2.3.4')).toBeInTheDocument()
  })

  it('shows a truncated image id when the image has no name', () => {
    // The image row only renders alongside flavor info (same as the Vue original).
    renderCard(make({ hardware: { flavor_name: 'm1.small', image_id: 'abcdef1234567890' } }))
    expect(screen.getByText('Image-ID: abcdef12…')).toBeInTheDocument()
  })

  it.each([
    ['missing', 'vm.drift.missingTitle', 'border-red-300'],
    ['stale', 'vm.drift.staleTitle', 'border-amber-300'],
  ])('shows the %s drift banner and border', (drift, title, border) => {
    const { container } = renderCard(make({ drift }))
    expect(screen.getByText(title)).toBeInTheDocument()
    expect(container.firstElementChild).toHaveClass(border)
  })

  it('shows no drift banner when in sync', () => {
    renderCard()
    expect(screen.queryByText('vm.drift.missingTitle')).not.toBeInTheDocument()
    expect(screen.queryByText('vm.drift.staleTitle')).not.toBeInTheDocument()
  })

  it('switches the details button label and accent when expanded', () => {
    const { container } = renderCard(make(), { isExpanded: true })
    expect(screen.getByRole('button', { name: 'vm.actions.hideDetails' })).toBeInTheDocument()
    expect(container.firstElementChild).toHaveClass('border-gray-800')
  })

  it('emits the address on details and redeploy', async () => {
    const { onOpenDetails, onRedeploy } = renderCard()

    await userEvent.click(screen.getByRole('button', { name: 'vm.actions.showDetails' }))
    await userEvent.click(screen.getByRole('button', { name: 'vm.actions.redeploy' }))

    expect(onOpenDetails).toHaveBeenCalledWith('openstack_compute_instance_v2.web')
    expect(onRedeploy).toHaveBeenCalledWith('openstack_compute_instance_v2.web')
  })

  it('hides the redeploy button when the caller may not redeploy', () => {
    renderCard(make(), { canRedeploy: false })
    expect(screen.queryByRole('button', { name: 'vm.actions.redeploy' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'vm.actions.showDetails' })).toBeInTheDocument()
  })

  it('disables the redeploy button while a redeploy is in flight', () => {
    renderCard(make(), { redeploying: true })
    expect(screen.getByRole('button', { name: 'vm.actions.redeploying' })).toBeDisabled()
  })
})
