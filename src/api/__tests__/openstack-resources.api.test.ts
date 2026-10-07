import { describe, it, expect, vi } from 'vitest'

vi.mock('@/api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

describe('openstackResourcesApi', () => {
  it('listNetworks() fetches the networks endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listNetworks()

    expect(api.get).toHaveBeenCalledWith('/me/openstack/resources/networks')
  })

  it('listSubnets() omits params when no network id is given', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listSubnets()

    expect(api.get).toHaveBeenCalledWith('/me/openstack/resources/subnets', { params: undefined })
  })

  it('listSubnets() filters by network id when given', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listSubnets('net-1')

    expect(api.get).toHaveBeenCalledWith('/me/openstack/resources/subnets', { params: { network_id: 'net-1' } })
  })

  it('listFlavors() fetches the flavors endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listFlavors()

    expect(api.get).toHaveBeenCalledWith('/me/openstack/resources/flavors')
  })

  it('listImages() defaults the status filter to active', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listImages()

    expect(api.get).toHaveBeenCalledWith('/me/openstack/resources/images', { params: { status: 'active' } })
  })

  it('listImages() forwards an explicit status filter', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listImages('queued')

    expect(api.get).toHaveBeenCalledWith('/me/openstack/resources/images', { params: { status: 'queued' } })
  })

  it('listKeypairs() fetches the keypairs endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listKeypairs()

    expect(api.get).toHaveBeenCalledWith('/me/openstack/resources/keypairs')
  })

  it('listSecurityGroups() fetches the security-groups endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listSecurityGroups()

    expect(api.get).toHaveBeenCalledWith('/me/openstack/resources/security-groups')
  })

  it('listFloatingIpPools() fetches the floating-ip-pools endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listFloatingIpPools()

    expect(api.get).toHaveBeenCalledWith('/me/openstack/resources/floating-ip-pools')
  })

  it('listVolumes() fetches the volumes endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listVolumes()

    expect(api.get).toHaveBeenCalledWith('/me/openstack/resources/volumes')
  })

  it('listRouters() fetches the routers endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listRouters()

    expect(api.get).toHaveBeenCalledWith('/me/openstack/resources/routers')
  })

  it('listAvailabilityZones() defaults the service to compute', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listAvailabilityZones()

    expect(api.get).toHaveBeenCalledWith('/me/openstack/resources/availability-zones', { params: { service: 'compute' } })
  })

  it('listAvailabilityZones() forwards an explicit service', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.listAvailabilityZones('network')

    expect(api.get).toHaveBeenCalledWith('/me/openstack/resources/availability-zones', { params: { service: 'network' } })
  })

  it('refresh() posts without params when no kind is given', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.refresh()

    expect(api.post).toHaveBeenCalledWith('/me/openstack/resources/refresh', null, { params: undefined })
  })

  it('refresh() scopes the cache-bust to a single kind when given', async () => {
    const api = (await import('@/api/axios')).default
    const { openstackResourcesApi } = await import('@/api/openstack-resources.api')

    openstackResourcesApi.refresh('flavor')

    expect(api.post).toHaveBeenCalledWith('/me/openstack/resources/refresh', null, { params: { kind: 'flavor' } })
  })
})
