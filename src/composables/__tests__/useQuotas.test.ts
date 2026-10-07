import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/quotas.api', () => ({ quotasApi: { getOverview: vi.fn() } }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

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

async function loadUseQuotas() {
  const mod = await import('../useQuotas')
  return mod.useQuotas
}

beforeEach(() => {
  vi.resetModules()
  sessionStorage.clear()
  vi.clearAllMocks()
})

describe('useQuotas', () => {
  it('starts with no cached quotas when sessionStorage is empty', async () => {
    const useQuotas = await loadUseQuotas()
    const { quotas, hasCachedQuotas, formattedQuotas } = useQuotas()

    expect(quotas.value).toBeNull()
    expect(hasCachedQuotas.value).toBe(false)
    expect(formattedQuotas.value).toEqual([])
  })

  it('seeds state from a previously cached sessionStorage value', async () => {
    sessionStorage.setItem('openstack.quotas.v1', JSON.stringify(overview))
    const useQuotas = await loadUseQuotas()
    const { quotas, hasCachedQuotas } = useQuotas()

    expect(quotas.value).toEqual(overview)
    expect(hasCachedQuotas.value).toBe(true)
  })

  it('tolerates corrupted sessionStorage content', async () => {
    sessionStorage.setItem('openstack.quotas.v1', '{not json')
    const useQuotas = await loadUseQuotas()
    const { quotas } = useQuotas()

    expect(quotas.value).toBeNull()
  })

  it('fetchQuotas populates quotas and caches them', async () => {
    const { quotasApi } = await import('@/api/quotas.api')
    vi.mocked(quotasApi.getOverview).mockResolvedValueOnce({ data: overview } as any)
    const useQuotas = await loadUseQuotas()
    const { quotas, loading, fetchQuotas } = useQuotas()

    await fetchQuotas()

    expect(quotas.value).toEqual(overview)
    expect(loading.value).toBe(false)
    expect(JSON.parse(sessionStorage.getItem('openstack.quotas.v1')!)).toEqual(overview)
  })

  it('fetchQuotas sets needsCredentials and clears the cache on a 412', async () => {
    sessionStorage.setItem('openstack.quotas.v1', JSON.stringify(overview))
    const { quotasApi } = await import('@/api/quotas.api')
    vi.mocked(quotasApi.getOverview).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 412 },
    })
    const useQuotas = await loadUseQuotas()
    const { quotas, needsCredentials, fetchQuotas } = useQuotas()

    await fetchQuotas()

    expect(needsCredentials.value).toBe(true)
    expect(quotas.value).toBeNull()
    expect(sessionStorage.getItem('openstack.quotas.v1')).toBeNull()
  })

  it('fetchQuotas records a generic error and keeps previously cached numbers on other failures', async () => {
    sessionStorage.setItem('openstack.quotas.v1', JSON.stringify(overview))
    const { quotasApi } = await import('@/api/quotas.api')
    vi.mocked(quotasApi.getOverview).mockRejectedValueOnce(new Error('network down'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const useQuotas = await loadUseQuotas()
    const { quotas, error, fetchQuotas } = useQuotas()
    quotas.value = overview as any

    await fetchQuotas()

    expect(error.value).toBe('Failed to fetch quotas')
    expect(quotas.value).toEqual(overview)
    consoleError.mockRestore()
  })

  describe('formattedQuotas', () => {
    it('maps the overview into display rows with computed percentages', async () => {
      const useQuotas = await loadUseQuotas()
      const { quotas, formattedQuotas } = useQuotas()
      quotas.value = overview as any

      const rows = formattedQuotas.value
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
      const useQuotas = await loadUseQuotas()
      const { getColorClass } = useQuotas()
      expect(getColorClass(pct)).toBe(expected)
    })
  })
})
