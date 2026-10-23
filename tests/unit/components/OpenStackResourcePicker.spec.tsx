import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/api/openstack-resources.api', () => ({
  openstackResourcesApi: {
    listFlavors: vi.fn(),
    listNetworks: vi.fn(),
    listSubnets: vi.fn(),
    listImages: vi.fn(),
    listKeypairs: vi.fn(),
    listSecurityGroups: vi.fn(),
    listFloatingIpPools: vi.fn(),
    listVolumes: vi.fn(),
    listRouters: vi.fn(),
    listAvailabilityZones: vi.fn(),
    refresh: vi.fn(),
  },
}))

import { openstackResourcesApi as api } from '@/api/openstack-resources.api'
import OpenStackResourcePicker from '@/components/OpenStackResourcePicker'
import { invalidateAll, setCredential } from '@/composables/useOpenStackResourceCache'
import { useToastStore } from '@/stores/toast.store'
import { renderWithProviders } from '../../helpers/render'

const flavors = [
  { id: 'f-1', name: 'm1.small', vcpus: 1, ram: 2048, disk: 20, is_public: true },
  { id: 'f-2', name: 'm1.large', vcpus: 4, ram: 8192, disk: 80, is_public: true },
]

const toasts = () => useToastStore.getState().toasts.map((t) => [t.type, t.message])

function setup(props: Partial<React.ComponentProps<typeof OpenStackResourcePicker>> = {}) {
  const onChange = vi.fn()
  const onCredentialsMissing = vi.fn()
  const utils = renderWithProviders(
    <OpenStackResourcePicker
      osType="flavor"
      osMode="name"
      value=""
      onChange={onChange}
      onCredentialsMissing={onCredentialsMissing}
      {...props}
    />,
  )
  return { ...utils, onChange, onCredentialsMissing }
}

const openPanel = async () => {
  await userEvent.click(screen.getByRole('button', { name: /openstackPicker\.selectSingular|openstackPicker\.selectPlural|m1\./ }))
}

beforeEach(() => {
  vi.clearAllMocks()
  setCredential('c-1')
  invalidateAll()
  useToastStore.setState({ toasts: [] })
  vi.mocked(api.listFlavors).mockResolvedValue({ data: flavors } as any)
  vi.mocked(api.refresh).mockResolvedValue({} as any)
})

describe('OpenStackResourcePicker', () => {
  it('lists resources with specs and picks one (single mode closes the panel)', async () => {
    const { onChange } = setup()
    await waitFor(() => expect(api.listFlavors).toHaveBeenCalled())

    await openPanel()
    expect(await screen.findByText('m1.small')).toBeInTheDocument()
    expect(screen.getByText('1 vCPU · 2 GB RAM · 20 GB Disk')).toBeInTheDocument()

    await userEvent.click(screen.getByText('m1.large'))

    expect(onChange).toHaveBeenCalledWith('m1.large')
    expect(screen.queryByPlaceholderText(/openstackPicker\.searchPlaceholder/)).not.toBeInTheDocument()
  })

  it('stores the id in id mode and shows the name for a stored id', async () => {
    const { onChange } = setup({ osMode: 'id', value: 'f-2' })

    expect(await screen.findByText('m1.large')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /m1\.large/ }))
    await userEvent.click(await screen.findByText('m1.small'))

    expect(onChange).toHaveBeenCalledWith('f-1')
  })

  it('deselects by clicking the selected entry', async () => {
    const { onChange } = setup({ value: 'm1.small' })
    await userEvent.click(await screen.findByRole('button', { name: /m1\.small/ }))

    const entries = await screen.findAllByText('m1.small')
    await userEvent.click(entries[entries.length - 1]!)

    expect(onChange).toHaveBeenCalledWith('')
  })

  it('filters the list through the search field', async () => {
    setup()
    await openPanel()
    await screen.findByText('m1.large')

    await userEvent.type(screen.getByPlaceholderText(/openstackPicker\.searchPlaceholder/), 'large')

    expect(screen.queryByText('m1.small')).not.toBeInTheDocument()
    expect(screen.getByText('m1.large')).toBeInTheDocument()
  })

  it('multi mode always emits arrays and keeps the panel open', async () => {
    const { onChange } = setup({ multi: true, value: ['m1.small'] })
    await screen.findByText('m1.small', { selector: 'span.truncate' })
    // The first button is the trigger (chips stop propagation themselves).
    await userEvent.click(screen.getAllByRole('button')[0]!)
    await userEvent.click(await screen.findByText('m1.large'))

    expect(onChange).toHaveBeenLastCalledWith(['m1.small', 'm1.large'])
  })

  it('removes a chip in multi mode', async () => {
    const { onChange } = setup({ multi: true, value: ['m1.small', 'm1.large'] })
    await screen.findByText('m1.large')

    const chip = screen.getByTitle('m1.large')
    await userEvent.click(chip.querySelector('button')!)

    expect(onChange).toHaveBeenCalledWith(['m1.small'])
  })

  it('migrates a CSV string value to an array on mount (multi)', async () => {
    const { onChange } = setup({ multi: true, value: 'm1.small, m1.large' })
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['m1.small', 'm1.large']))
  })

  it('flags a value that is not in the loaded list as external', async () => {
    setup({ value: 'legacy-flavor' })

    expect(await screen.findByText('openstackPicker.externalBadge')).toBeInTheDocument()
    expect(screen.getByText('legacy-flavor')).toBeInTheDocument()
  })

  it('shows a compact hint and reports missing credentials (412)', async () => {
    vi.mocked(api.listFlavors).mockRejectedValue({
      response: { status: 412, data: { detail: { reason: 'openstack_credentials_missing' } } },
    })
    const { onCredentialsMissing } = setup()

    expect(await screen.findByText('openstackPicker.credentialsRequired')).toBeInTheDocument()
    await waitFor(() => expect(onCredentialsMissing).toHaveBeenLastCalledWith(true))
  })

  it('offers manual entry when OpenStack is unreachable and emits typed values', async () => {
    vi.mocked(api.listFlavors).mockRejectedValue({ response: { status: 502, data: { detail: { message: 'down' } } } })
    const { onChange } = setup({ allowFreeText: true })
    await waitFor(() => expect(api.listFlavors).toHaveBeenCalled())

    await openPanel()
    expect(await screen.findByText('down')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'openstackPicker.enterManually' }))
    await userEvent.type(screen.getByRole('textbox'), 'x')

    expect(onChange).toHaveBeenLastCalledWith('x')
  })

  it('multi free text splits on commas into an array', async () => {
    vi.mocked(api.listFlavors).mockRejectedValue({ response: { status: 502 } })
    const { onChange } = setup({ multi: true, allowFreeText: true })
    await waitFor(() => expect(api.listFlavors).toHaveBeenCalled())
    await userEvent.click(await screen.findByRole('button', { name: /openstackPicker\.selectPlural/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'openstackPicker.enterManually' }))

    await userEvent.type(screen.getByRole('textbox'), 'a,b')

    expect(onChange).toHaveBeenLastCalledWith(['a', 'b'])
  })

  it('refresh reloads and reports entries that disappeared', async () => {
    setup({ value: 'm1.large' })
    await screen.findByText('m1.large')
    vi.mocked(api.listFlavors).mockResolvedValue({ data: [flavors[0]] } as any)

    await userEvent.click(screen.getByTitle('openstackPicker.refreshList'))

    await waitFor(() => expect(api.refresh).toHaveBeenCalledWith('c-1', 'flavor'))
    await waitFor(() =>
      expect(toasts()).toContainEqual(['warning', 'openstackPicker.toasts.removed']),
    )
  })

  it('refresh confirms when nothing disappeared', async () => {
    setup({ value: 'm1.small' })
    await screen.findByText('m1.small')

    await userEvent.click(screen.getByTitle('openstackPicker.refreshList'))

    await waitFor(() => expect(toasts()).toContainEqual(['success', 'openstackPicker.toasts.listRefreshed']))
  })

  it('restricts subnets to the given network and reloads when it changes', async () => {
    vi.mocked(api.listSubnets).mockResolvedValue({ data: [] } as any)
    const { rerender, onChange } = setup({ osType: 'subnet', filterNetworkId: 'net-1' })
    await waitFor(() => expect(api.listSubnets).toHaveBeenCalledWith('c-1', 'net-1'))

    rerender(
      <OpenStackResourcePicker osType="subnet" osMode="name" value="" onChange={onChange} filterNetworkId="net-2" />,
    )

    await waitFor(() => expect(api.listSubnets).toHaveBeenCalledWith('c-1', 'net-2'))
  })
})
