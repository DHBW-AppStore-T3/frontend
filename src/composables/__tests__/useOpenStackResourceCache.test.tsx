import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'

vi.mock('@/api/openstack-resources.api', () => ({
  openstackResourcesApi: { listNetworks: vi.fn() },
}))

import {
  prime,
  invalidate,
  invalidateAll,
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
    invalidateAll()
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
})
