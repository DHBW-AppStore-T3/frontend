import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/api/quotas.api', () => ({ quotasApi: { getOverview: vi.fn() } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const overview = {
  compute: {
    instances: { used: 2, limit: 10 },
    vcpus: { used: 4, limit: 20 },
    ram: { used: 2048, limit: 8192 },
  },
  storage: {
    volumes: { used: 1, limit: 5 },
    gigabytes: { used: 20, limit: 100 },
  },
  network: {
    floating_ips: { used: 1, limit: 3 },
  },
}

// Fresh module (and thus fresh module-scoped store + sessionStorage seed) per test.
async function setup() {
  const mod = await import('../useQuotas')
  const hook = renderHook(() => mod.useQuotas())
  return {
    hook,
    get current() {
      return hook.result.current
    },
    seed: (value: unknown) => act(() => mod.useQuotaStore.setState({ quotas: value as any })),
  }
}

beforeEach(() => {
  vi.resetModules()
  sessionStorage.clear()
  vi.clearAllMocks()
})

describe('useQuotas', () => {
  it('starts with no cached quotas when sessionStorage is empty', async () => {
    const q = await setup()

    expect(q.current.quotas).toBeNull()
    expect(q.current.hasCachedQuotas).toBe(false)
    expect(q.current.formattedQuotas).toEqual([])
  })

  it('seeds state from a previously cached sessionStorage value', async () => {
    sessionStorage.setItem('openstack.quotas.v1', JSON.stringify(overview))
    const q = await setup()

    expect(q.current.quotas).toEqual(overview)
    expect(q.current.hasCachedQuotas).toBe(true)
  })

  it('tolerates corrupted sessionStorage content', async () => {
    sessionStorage.setItem('openstack.quotas.v1', '{not json')
    const q = await setup()

    expect(q.current.quotas).toBeNull()
  })

  it('fetchQuotas populates quotas and caches them', async () => {
    const { quotasApi } = await import('@/api/quotas.api')
    vi.mocked(quotasApi.getOverview).mockResolvedValueOnce({ data: overview } as any)
    const q = await setup()

    await act(() => q.current.fetchQuotas())

    expect(q.current.quotas).toEqual(overview)
    expect(q.current.loading).toBe(false)
    expect(JSON.parse(sessionStorage.getItem('openstack.quotas.v1')!)).toEqual(overview)
  })

  it('fetchQuotas sets needsCredentials and clears the cache on a 412', async () => {
    sessionStorage.setItem('openstack.quotas.v1', JSON.stringify(overview))
    const { quotasApi } = await import('@/api/quotas.api')
    vi.mocked(quotasApi.getOverview).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 412 },
    })
    const q = await setup()

    await act(() => q.current.fetchQuotas())

    expect(q.current.needsCredentials).toBe(true)
    expect(q.current.quotas).toBeNull()
    expect(sessionStorage.getItem('openstack.quotas.v1')).toBeNull()
  })

  it('fetchQuotas records a generic error and keeps previously cached numbers on other failures', async () => {
    sessionStorage.setItem('openstack.quotas.v1', JSON.stringify(overview))
    const { quotasApi } = await import('@/api/quotas.api')
    vi.mocked(quotasApi.getOverview).mockRejectedValueOnce(new Error('network down'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const q = await setup()
    q.seed(overview)

    await act(() => q.current.fetchQuotas())

    expect(q.current.error).toBe('Failed to fetch quotas')
    expect(q.current.quotas).toEqual(overview)
    consoleError.mockRestore()
  })

  describe('formattedQuotas', () => {
    it('maps the overview into display rows with computed percentages', async () => {
      const q = await setup()
      q.seed(overview)

      const rows = q.current.formattedQuotas
      expect(rows).toHaveLength(6)
      expect(rows[0]).toMatchObject({ label: 'workspace.quotas.instances', used: 2, limit: 10, percentage: 20 })
      expect(rows[2]).toMatchObject({ label: 'workspace.quotas.ram', used: 2, limit: 8, unit: 'GB' })
    })
  })

  describe('getColorClass', () => {
    it.each([
      [95, 'bg-red-500'],
      [80, 'bg-orange-500'],
      [60, 'bg-yellow-500'],
      [10, 'bg-green-500'],
    ])('returns %s%% -> %s', async (pct, expected) => {
      const q = await setup()
      expect(q.current.getColorClass(pct)).toBe(expected)
    })
  })
})
