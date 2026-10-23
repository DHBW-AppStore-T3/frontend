import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

vi.mock('@/api/openstack-resources.api', () => ({
  openstackResourcesApi: {
    listNetworks: vi.fn(),
    listSubnets: vi.fn(),
    listAvailabilityZones: vi.fn(),
    refresh: vi.fn(),
  },
}))

import { openstackResourcesApi as api } from '@/api/openstack-resources.api'
import { setCredential, invalidateAll } from '@/composables/useOpenStackResourceCache'
import { useResourceList } from '../useResourceList'

const fallbackMessages = { osError: 'OpenStack error', loadFailed: 'Load failed' }
const options = { osType: 'network' as const, enabled: true, fallbackMessages }

beforeEach(() => {
  vi.clearAllMocks()
  setCredential(null)
  invalidateAll()
})

describe('useResourceList', () => {
  it('lists with the chosen credential', async () => {
    setCredential('c-1')
    vi.mocked(api.listNetworks).mockResolvedValue({ data: [{ id: 'n-1', name: 'private' }] } as never)

    const { result } = renderHook(() => useResourceList(options))

    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(api.listNetworks).toHaveBeenCalledWith('c-1')
    expect(result.current.error).toBeNull()
  })

  it('reports missing credentials when none is chosen, without asking the API', async () => {
    const { result } = renderHook(() => useResourceList(options))

    await waitFor(() => expect(result.current.error).toEqual({ reason: 'credentials_missing', message: '' }))
    expect(api.listNetworks).not.toHaveBeenCalled()
  })

  it('treats a 404 (credential is not the caller\'s any more) as missing credentials', async () => {
    setCredential('c-gone')
    vi.mocked(api.listNetworks).mockRejectedValue({ response: { status: 404 } })

    const { result } = renderHook(() => useResourceList(options))

    await waitFor(() => expect(result.current.error?.reason).toBe('credentials_missing'))
  })

  it('reports an unavailable OpenStack with the API message', async () => {
    setCredential('c-1')
    vi.mocked(api.listNetworks).mockRejectedValue({
      response: { status: 502, data: { detail: { reason: 'openstack_unavailable', message: 'Keystone down' } } },
    })

    const { result } = renderHook(() => useResourceList(options))

    await waitFor(() => expect(result.current.error).toEqual({ reason: 'unavailable', message: 'Keystone down' }))
  })

  it('restricts subnets to one network and gives the az service its default', async () => {
    setCredential('c-1')
    vi.mocked(api.listSubnets).mockResolvedValue({ data: [] } as never)
    vi.mocked(api.listAvailabilityZones).mockResolvedValue({ data: [] } as never)

    renderHook(() => useResourceList({ ...options, osType: 'subnet', filterNetworkId: 'n-1' }))
    renderHook(() => useResourceList({ ...options, osType: 'availability_zone' }))

    await waitFor(() => expect(api.listSubnets).toHaveBeenCalledWith('c-1', 'n-1'))
    await waitFor(() => expect(api.listAvailabilityZones).toHaveBeenCalledWith('c-1', 'compute'))
  })

  it('shows nothing and is not loading while disabled (free-text mode)', () => {
    setCredential('c-1')
    vi.mocked(api.listNetworks).mockResolvedValue({ data: [{ id: 'n-1', name: 'private' }] } as never)

    const { result } = renderHook(() => useResourceList({ ...options, enabled: false }))

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toEqual([])
  })

  it('refresh drops the backend copy of the chosen credential and reloads', async () => {
    setCredential('c-1')
    vi.mocked(api.listNetworks).mockResolvedValue({ data: [] } as never)
    vi.mocked(api.refresh).mockResolvedValue({} as never)
    const { result } = renderHook(() => useResourceList(options))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    vi.mocked(api.listNetworks).mockClear()

    await act(() => result.current.refresh())

    expect(api.refresh).toHaveBeenCalledWith('c-1', 'network')
    await waitFor(() => expect(api.listNetworks).toHaveBeenCalled())
  })
})
