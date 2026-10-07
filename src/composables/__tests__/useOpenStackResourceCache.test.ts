import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/openstack-resources.api', () => ({
  openstackResourcesApi: {
    listNetworks: vi.fn(),
    listSubnets: vi.fn(),
    listFlavors: vi.fn(),
    listImages: vi.fn(),
    listKeypairs: vi.fn(),
    listSecurityGroups: vi.fn(),
    listFloatingIpPools: vi.fn(),
    listVolumes: vi.fn(),
    listRouters: vi.fn(),
    listAvailabilityZones: vi.fn(),
  },
}))

import { openstackResourcesApi } from '@/api/openstack-resources.api'
import {
  prime,
  invalidate,
  invalidateAll,
  getDisplayName,
  ensureLoaded,
} from '@/composables/useOpenStackResourceCache'

const mockApi = vi.mocked(openstackResourcesApi)

const NETWORKS = [
  { id: 'net-1', name: 'shared-net', description: '', shared: true, external: false, status: 'ACTIVE' },
  { id: 'net-2', name: 'private-net', description: '', shared: false, external: false, status: 'ACTIVE' },
]

beforeEach(() => {
  invalidateAll()
  vi.clearAllMocks()
})

// ===========================================================================
// prime() / invalidate() / invalidateAll()
// ===========================================================================
describe('prime()', () => {
  it('populates the cache synchronously', () => {
    prime('network', NETWORKS)
    const result = getDisplayName('network', 'id', 'net-1')
    expect(result).toEqual({ name: 'shared-net', known: true })
  })

  it('overwrites an existing cache entry for the same osType', () => {
    prime('network', NETWORKS)
    prime('network', [{ id: 'net-99', name: 'updated-net' }])
    expect(getDisplayName('network', 'id', 'net-1')).toMatchObject({ known: false })
    expect(getDisplayName('network', 'id', 'net-99')).toMatchObject({ known: true })
  })
})

describe('invalidate()', () => {
  it('removes the specified osType from the cache', () => {
    prime('network', NETWORKS)
    invalidate('network')
    expect(getDisplayName('network', 'id', 'net-1')).toMatchObject({ known: false })
  })

  it('is a no-op for an unknown osType (does not throw)', () => {
    expect(() => invalidate('flavor')).not.toThrow()
  })
})

describe('invalidateAll()', () => {
  it('clears the entire cache', () => {
    prime('network', NETWORKS)
    prime('flavor', [{ id: 'fl-1', name: 'm1.small' }])
    invalidateAll()
    expect(getDisplayName('network', 'id', 'net-1')).toMatchObject({ known: false })
    expect(getDisplayName('flavor', 'id', 'fl-1')).toMatchObject({ known: false })
  })

  it('is a no-op when cache is empty (does not throw)', () => {
    expect(() => invalidateAll()).not.toThrow()
  })
})

// ===========================================================================
// getDisplayName()
// ===========================================================================
describe('getDisplayName()', () => {
  it('returns null for null value', () => {
    expect(getDisplayName('network', 'id', null)).toBeNull()
  })

  it('returns null for undefined value', () => {
    expect(getDisplayName('network', 'id', undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(getDisplayName('network', 'id', '')).toBeNull()
  })

  it('cache miss → known=false, name=value', () => {
    const result = getDisplayName('network', 'id', 'net-unknown')
    expect(result).toEqual({ name: 'net-unknown', known: false })
  })

  it('mode="id" match by id → known=true', () => {
    prime('network', NETWORKS)
    expect(getDisplayName('network', 'id', 'net-1')).toEqual({ name: 'shared-net', known: true })
  })

  it('mode="name" match by name → known=true', () => {
    prime('network', NETWORKS)
    expect(getDisplayName('network', 'name', 'private-net')).toEqual({ name: 'private-net', known: true })
  })

  it('primary miss, cross-mode fallback → known=true, modeMismatch=true', () => {
    prime('network', NETWORKS)
    // mode='id' but value is a name string → primary miss, fallback by name
    const result = getDisplayName('network', 'id', 'shared-net')
    expect(result).toEqual({ name: 'shared-net', known: true, modeMismatch: true })
  })

  it('primary miss, no cross-mode match → known=false', () => {
    prime('network', NETWORKS)
    const result = getDisplayName('network', 'id', 'does-not-exist')
    expect(result).toEqual({ name: 'does-not-exist', known: false })
  })
})

// ===========================================================================
// ensureLoaded()
// ===========================================================================
describe('ensureLoaded()', () => {
  it('fetches and caches network list on first call', async () => {
    mockApi.listNetworks.mockResolvedValue({ data: NETWORKS } as any)
    await ensureLoaded('network')
    expect(mockApi.listNetworks).toHaveBeenCalledOnce()
    expect(getDisplayName('network', 'id', 'net-1')).toMatchObject({ known: true })
  })

  it('does not re-fetch when cache is fresh', async () => {
    mockApi.listNetworks.mockResolvedValue({ data: NETWORKS } as any)
    await ensureLoaded('network')
    await ensureLoaded('network')
    expect(mockApi.listNetworks).toHaveBeenCalledOnce()
  })

  it('parallel calls all complete and cache is populated', async () => {
    mockApi.listNetworks.mockResolvedValue({ data: NETWORKS } as any)
    await Promise.all([ensureLoaded('network'), ensureLoaded('network'), ensureLoaded('network')])
    // All three calls resolved; cache must contain the result regardless of fetch count
    expect(getDisplayName('network', 'id', 'net-1')).toMatchObject({ known: true })
  })

  it('swallows API errors — cache stays empty, does not throw', async () => {
    mockApi.listFlavors.mockRejectedValue(new Error('412'))
    await expect(ensureLoaded('flavor')).resolves.toBeUndefined()
    expect(getDisplayName('flavor', 'id', 'fl-1')).toMatchObject({ known: false })
  })

  it('fetches flavors (covers flavor switch case)', async () => {
    mockApi.listFlavors.mockResolvedValue({ data: [{ id: 'fl-1', name: 'm1.small' }] } as any)
    await ensureLoaded('flavor')
    expect(mockApi.listFlavors).toHaveBeenCalledOnce()
    expect(getDisplayName('flavor', 'id', 'fl-1')).toMatchObject({ known: true })
  })

  it('fetches images (covers image switch case)', async () => {
    mockApi.listImages.mockResolvedValue({ data: [{ id: 'img-1', name: 'ubuntu-22.04' }] } as any)
    await ensureLoaded('image')
    expect(mockApi.listImages).toHaveBeenCalledWith('active')
    expect(getDisplayName('image', 'id', 'img-1')).toMatchObject({ known: true })
  })

  it('fetches keypairs (covers keypair switch case)', async () => {
    mockApi.listKeypairs.mockResolvedValue({ data: [{ id: 'key-1', name: 'my-key' }] } as any)
    await ensureLoaded('keypair')
    expect(getDisplayName('keypair', 'id', 'key-1')).toMatchObject({ known: true })
  })

  it('fetches security_group (covers security_group switch case)', async () => {
    mockApi.listSecurityGroups.mockResolvedValue({ data: [{ id: 'sg-1', name: 'default' }] } as any)
    await ensureLoaded('security_group')
    expect(getDisplayName('security_group', 'id', 'sg-1')).toMatchObject({ known: true })
  })

  it('fetches subnet (covers subnet switch case)', async () => {
    mockApi.listSubnets.mockResolvedValue({ data: [{ id: 'sub-1', name: 'subnet-a' }] } as any)
    await ensureLoaded('subnet')
    expect(getDisplayName('subnet', 'id', 'sub-1')).toMatchObject({ known: true })
  })

  it('fetches floating_ip_pool (covers floating_ip_pool switch case)', async () => {
    mockApi.listFloatingIpPools.mockResolvedValue({ data: [{ id: 'pool-1', name: 'public' }] } as any)
    await ensureLoaded('floating_ip_pool')
    expect(getDisplayName('floating_ip_pool', 'id', 'pool-1')).toMatchObject({ known: true })
  })

  it('fetches volume (covers volume switch case)', async () => {
    mockApi.listVolumes.mockResolvedValue({ data: [{ id: 'vol-1', name: 'boot-vol' }] } as any)
    await ensureLoaded('volume')
    expect(getDisplayName('volume', 'id', 'vol-1')).toMatchObject({ known: true })
  })

  it('fetches router (covers router switch case)', async () => {
    mockApi.listRouters.mockResolvedValue({ data: [{ id: 'rtr-1', name: 'router-a' }] } as any)
    await ensureLoaded('router')
    expect(getDisplayName('router', 'id', 'rtr-1')).toMatchObject({ known: true })
  })

  it('fetches availability_zone (covers availability_zone switch case)', async () => {
    mockApi.listAvailabilityZones.mockResolvedValue({ data: [{ id: 'nova', name: 'nova' }] } as any)
    await ensureLoaded('availability_zone')
    expect(mockApi.listAvailabilityZones).toHaveBeenCalledWith('compute')
    expect(getDisplayName('availability_zone', 'id', 'nova')).toMatchObject({ known: true })
  })
})
