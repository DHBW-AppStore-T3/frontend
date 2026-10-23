import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'

vi.mock('@/api/openstack-resources.api', () => ({
  openstackResourcesApi: { listNetworks: vi.fn(), listImages: vi.fn() },
}))
import { openstackResourcesApi } from '@/api/openstack-resources.api'

import {
  prime,
  invalidate,
  invalidateAll,
  ensureLoaded,
  setCredential,
  currentCredential,
  getDisplayName,
  useOpenStackCacheVersion,
} from '../useOpenStackResourceCache'

function Probe({ osType, value }: { osType: 'network'; value: string }) {
  useOpenStackCacheVersion()
  const d = getDisplayName(osType, 'id', value)
  return <p>{d ? `${d.name}:${d.known}` : 'none'}</p>
}

describe('useOpenStackResourceCache', () => {
  beforeEach(() => {
    setCredential(null)
    invalidateAll()
    vi.clearAllMocks()
  })

  it('resolves ids to names, with cross-mode fallback and raw fallback', () => {
    prime('network', [{ id: 'n-1', name: 'private' } as any])

    expect(getDisplayName('network', 'id', 'n-1')).toEqual({ name: 'private', known: true })
    expect(getDisplayName('network', 'name', 'n-1')).toEqual({
      name: 'private',
      known: true,
      modeMismatch: true,
    })
    expect(getDisplayName('network', 'id', 'zzz')).toEqual({ name: 'zzz', known: false })
    expect(getDisplayName('network', 'id', null)).toBeNull()
  })

  it('re-renders subscribed components when the cache changes', () => {
    render(<Probe osType="network" value="n-1" />)
    expect(screen.getByText('n-1:false')).toBeInTheDocument()

    act(() => prime('network', [{ id: 'n-1', name: 'private' } as any]))
    expect(screen.getByText('private:true')).toBeInTheDocument()

    act(() => invalidate('network'))
    expect(screen.getByText('n-1:false')).toBeInTheDocument()
  })

  it('invalidateAll clears everything and notifies', () => {
    prime('network', [{ id: 'n-1', name: 'private' } as any])
    render(<Probe osType="network" value="n-1" />)

    act(() => invalidateAll())

    expect(screen.getByText('n-1:false')).toBeInTheDocument()
  })

  describe('credential', () => {
    it('reads every list with the chosen credential', async () => {
      vi.mocked(openstackResourcesApi.listNetworks).mockResolvedValueOnce({ data: [{ id: 'n-1', name: 'private' }] } as never)
      vi.mocked(openstackResourcesApi.listImages).mockResolvedValueOnce({ data: [] } as never)
      setCredential('c-1')

      await ensureLoaded('network')
      await ensureLoaded('image')

      expect(openstackResourcesApi.listNetworks).toHaveBeenCalledWith('c-1')
      expect(openstackResourcesApi.listImages).toHaveBeenCalledWith('c-1', 'active')
      expect(getDisplayName('network', 'id', 'n-1')?.name).toBe('private')
    })

    it('asks nothing while no credential is chosen', async () => {
      await ensureLoaded('network')

      expect(openstackResourcesApi.listNetworks).not.toHaveBeenCalled()
      expect(currentCredential()).toBeNull()
    })

    it('empties the cache when another credential is chosen, but not for the same one', () => {
      setCredential('c-1')
      prime('network', [{ id: 'n-1', name: 'private' } as never])

      setCredential('c-1')
      expect(getDisplayName('network', 'id', 'n-1')?.known).toBe(true)

      setCredential('c-2')
      expect(getDisplayName('network', 'id', 'n-1')?.known).toBe(false)
      expect(currentCredential()).toBe('c-2')
    })

    it('drops a list that arrives after the credential was switched', async () => {
      let resolve: (v: unknown) => void = () => {}
      vi.mocked(openstackResourcesApi.listNetworks).mockReturnValueOnce(new Promise((r) => (resolve = r)) as never)
      setCredential('c-1')
      const loading = ensureLoaded('network')

      setCredential('c-2')
      resolve({ data: [{ id: 'n-1', name: 'from-c1' }] })
      await loading

      expect(getDisplayName('network', 'id', 'n-1')?.known).toBe(false)
    })
  })
})
