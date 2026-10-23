import { describe, it, expect, vi } from 'vitest'

vi.mock('@/api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

describe('openstackResourcesApi', () => {
  it('listNetworks() fetches the networks endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listNetworks('c-1')

    expect(api.get).toHaveBeenCalledWith('/me/openstack-credentials/c-1/resources/networks')
  })

  it('listSubnets() omits params when no network id is given', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listSubnets('c-1')

    expect(api.get).toHaveBeenCalledWith('/me/openstack-credentials/c-1/resources/subnets', { params: undefined })
  })

  it('listSubnets() filters by network id when given', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listSubnets('c-1', 'net-1')

    expect(api.get).toHaveBeenCalledWith('/me/openstack-credentials/c-1/resources/subnets', { params: { network_id: 'net-1' } })
  })

  it('listFlavors() fetches the flavors endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listFlavors('c-1')

    expect(api.get).toHaveBeenCalledWith('/me/openstack-credentials/c-1/resources/flavors')
  })

  it('listImages() defaults the status filter to active', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listImages('c-1')

    expect(api.get).toHaveBeenCalledWith('/me/openstack-credentials/c-1/resources/images', { params: { status: 'active' } })
  })

  it('listImages() forwards an explicit status filter', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listImages('c-1', 'queued')

    expect(api.get).toHaveBeenCalledWith('/me/openstack-credentials/c-1/resources/images', { params: { status: 'queued' } })
  })

  it('listKeypairs() fetches the keypairs endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listKeypairs('c-1')

    expect(api.get).toHaveBeenCalledWith('/me/openstack-credentials/c-1/resources/keypairs')
  })

  it('listSecurityGroups() fetches the security-groups endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listSecurityGroups('c-1')

    expect(api.get).toHaveBeenCalledWith('/me/openstack-credentials/c-1/resources/security-groups')
  })

  it('listFloatingIpPools() fetches the floating-ip-pools endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listFloatingIpPools('c-1')

    expect(api.get).toHaveBeenCalledWith('/me/openstack-credentials/c-1/resources/floating-ip-pools')
  })

  it('listVolumes() fetches the volumes endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listVolumes('c-1')

    expect(api.get).toHaveBeenCalledWith('/me/openstack-credentials/c-1/resources/volumes')
  })

  it('listRouters() fetches the routers endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listRouters('c-1')

    expect(api.get).toHaveBeenCalledWith('/me/openstack-credentials/c-1/resources/routers')
  })

  it('listAvailabilityZones() defaults the service to compute', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listAvailabilityZones('c-1')

    expect(api.get).toHaveBeenCalledWith('/me/openstack-credentials/c-1/resources/availability-zones', { params: { service: 'compute' } })
  })

  it('listAvailabilityZones() forwards an explicit service', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listAvailabilityZones('c-1', 'network')

    expect(api.get).toHaveBeenCalledWith('/me/openstack-credentials/c-1/resources/availability-zones', { params: { service: 'network' } })
  })

  it('refresh() posts without params when no kind is given', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.refresh('c-1')

    expect(api.post).toHaveBeenCalledWith('/me/openstack-credentials/c-1/resources/refresh', null, { params: undefined })
  })

  it('refresh() scopes the cache-bust to a single kind when given', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.refresh('c-1', 'flavor')

    expect(api.post).toHaveBeenCalledWith('/me/openstack-credentials/c-1/resources/refresh', null, { params: { kind: 'flavor' } })
  })
})
