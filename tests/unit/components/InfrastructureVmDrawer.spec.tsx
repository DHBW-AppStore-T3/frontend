import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/api/deployment.api', () => ({
  deploymentApi: { getResourceDetail: vi.fn() },
}))

import { deploymentApi } from '@/api/deployment.api'
import InfrastructureVmDrawer from '@/components/InfrastructureVmDrawer'
import { renderWithProviders } from '../../helpers/render'

const detail = (over: Record<string, unknown> = {}) =>
  ({
    address: 'openstack_compute_instance_v2.web',
    display_name: 'web-1',
    provider_id: 'uuid-1',
    team: 'Team-A',
    lifecycle: { status: 'ACTIVE', task_state: null, vm_state: 'active', power_state: 'running' },
    hardware: { flavor_name: 'm1.small', vcpus: 2, ram_mb: 2048, disk_gb: 20, image_name: 'ubuntu' },
    addresses: [{ network: 'private', fixed_ip: '10.0.0.5', mac: 'aa:bb' }],
    ports: [
      {
        port_id: '12345678-aaaa',
        fixed_ip: '10.0.0.5',
        mac: 'aa:bb',
        status: 'ACTIVE',
        network_id: 'n1',
        security_group_ids: ['sg1'],
      },
    ],
    security_groups: [{ id: 'sg1', name: 'default', description: 'd', ingress_rules: 2, egress_rules: 1 }],
    volumes: [{ volume_id: 'vol-12345678', name: 'data', status: 'in-use', size_gb: 10, device: '/dev/vdb', bootable: true }],
    metadata: { owner: 'lea' },
    ...over,
  }) as any

function renderDrawer(props: Partial<React.ComponentProps<typeof InfrastructureVmDrawer>> = {}) {
  const onClose = vi.fn()
  const utils = renderWithProviders(
    <InfrastructureVmDrawer
      deploymentId="d-1"
      address="openstack_compute_instance_v2.web"
      onClose={onClose}
      {...props}
    />,
  )
  return { ...utils, onClose }
}

beforeEach(() => {
  vi.mocked(deploymentApi.getResourceDetail).mockReset()
})

describe('InfrastructureVmDrawer', () => {
  it('fetches the detail for the deployment/address and renders the sections', async () => {
    vi.mocked(deploymentApi.getResourceDetail).mockResolvedValue({ data: detail() } as any)
    renderDrawer()

    expect(await screen.findByText('web-1')).toBeInTheDocument()
    expect(deploymentApi.getResourceDetail).toHaveBeenCalledWith(
      'd-1',
      'openstack_compute_instance_v2.web',
    )
    expect(screen.getByText('Team-A')).toBeInTheDocument()
    expect(screen.getByText('m1.small')).toBeInTheDocument()
    expect(screen.getByText('2048 MB')).toBeInTheDocument()
    expect(screen.getByText('20 vm.units.gb')).toBeInTheDocument()
    expect(screen.getByText('12345678…')).toBeInTheDocument()
    expect(screen.getByText('default')).toBeInTheDocument()
    expect(screen.getByText('data')).toBeInTheDocument()
    expect(screen.getByText('owner')).toBeInTheDocument()
  })

  it('resolves the network name of a port via its fixed ip', async () => {
    vi.mocked(deploymentApi.getResourceDetail).mockResolvedValue({ data: detail() } as any)
    renderDrawer()

    await screen.findByText('web-1')
    // "private" is the address' network name and the port badge.
    expect(screen.getAllByText('private').length).toBeGreaterThanOrEqual(2)
  })

  it('shows the loading state before data arrives', () => {
    vi.mocked(deploymentApi.getResourceDetail).mockReturnValue(new Promise(() => {}))
    renderDrawer()
    expect(screen.getByText('vm.drawer.loading')).toBeInTheDocument()
  })

  it.each([
    [404, 'vm.drawer.errors.notFound'],
    [412, 'vm.drawer.errors.missingCredentials'],
    [502, 'vm.drawer.errors.unreachable'],
  ])('maps HTTP %s to an inline error', async (status, key) => {
    vi.mocked(deploymentApi.getResourceDetail).mockRejectedValue({ response: { status } })
    renderDrawer()
    expect(await screen.findByText(key)).toBeInTheDocument()
  })

  it('falls back to the error message, then the generic message', async () => {
    vi.mocked(deploymentApi.getResourceDetail).mockRejectedValueOnce({ message: 'kaputt' })
    const { unmount } = renderDrawer()
    expect(await screen.findByText('kaputt')).toBeInTheDocument()
    unmount()

    vi.mocked(deploymentApi.getResourceDetail).mockRejectedValueOnce({})
    renderDrawer()
    expect(await screen.findByText('vm.drawer.errors.generic')).toBeInTheDocument()
  })

  it('refetches when the address prop changes', async () => {
    vi.mocked(deploymentApi.getResourceDetail).mockResolvedValue({ data: detail() } as any)
    const { rerender } = renderDrawer()
    await screen.findByText('web-1')

    rerender(
      <InfrastructureVmDrawer deploymentId="d-1" address="openstack_compute_instance_v2.db" onClose={() => {}} />,
    )

    await waitFor(() =>
      expect(deploymentApi.getResourceDetail).toHaveBeenLastCalledWith(
        'd-1',
        'openstack_compute_instance_v2.db',
      ),
    )
  })

  it('reloads on the refresh button and closes via the close button', async () => {
    vi.mocked(deploymentApi.getResourceDetail).mockResolvedValue({ data: detail() } as any)
    const { onClose } = renderDrawer()
    await screen.findByText('web-1')

    await userEvent.click(screen.getByTitle('vm.actions.refresh'))
    await waitFor(() => expect(deploymentApi.getResourceDetail).toHaveBeenCalledTimes(2))

    await userEvent.click(screen.getByTitle('vm.actions.closeDetails'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('omits optional sections when the data is absent', async () => {
    vi.mocked(deploymentApi.getResourceDetail).mockResolvedValue({
      data: detail({ lifecycle: null, hardware: null, addresses: [], ports: undefined, security_groups: undefined, volumes: undefined, metadata: {} }),
    } as any)
    renderDrawer()
    await screen.findByText('web-1')

    expect(screen.queryByText('vm.drawer.sections.lifecycle')).not.toBeInTheDocument()
    expect(screen.queryByText('vm.drawer.sections.hardware')).not.toBeInTheDocument()
    expect(screen.queryByText('vm.drawer.sections.metadata')).not.toBeInTheDocument()
  })
})
