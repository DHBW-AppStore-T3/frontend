import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/quotas.api', () => ({ quotasApi: { getForCredential: vi.fn() } }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const overview = {
  compute: {
    instances: { used: 2, limit: 10 },
    vcpus: { used: 4, limit: 20 },
    ram: { used: 2048, limit: 8192 },
  },
  storage: {
    volumes: { used: 1, limit: 5 },
    gigabytes: { used: 20, limit: -1 },
  },
  network: {
    floating_ips: { used: 1, limit: 3 },
  },
}

const KEY = 'openstack.quotas.v2.c-1'

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
  it('starts with nothing selected and no quotas', async () => {
    const useQuotas = await loadUseQuotas()
    const { credentialId, quotas, hasCachedQuotas, formattedQuotas } = useQuotas()

    expect(credentialId.value).toBeNull()
    expect(quotas.value).toBeNull()
    expect(hasCachedQuotas.value).toBe(false)
    expect(formattedQuotas.value).toEqual([])
  })

  it('selecting a credential shows its cached numbers first', async () => {
    sessionStorage.setItem(KEY, JSON.stringify(overview))
    const useQuotas = await loadUseQuotas()
    const { quotas, hasCachedQuotas, selectCredential } = useQuotas()

    selectCredential('c-1')

    expect(quotas.value).toEqual(overview)
    expect(hasCachedQuotas.value).toBe(true)
  })

  it('tolerates corrupted sessionStorage content', async () => {
    sessionStorage.setItem(KEY, '{not json')
    const useQuotas = await loadUseQuotas()
    const { quotas, selectCredential } = useQuotas()

    selectCredential('c-1')

    expect(quotas.value).toBeNull()
  })

  it('fetchQuotas asks for the selected credential\'s project and caches per credential', async () => {
    const { quotasApi } = await import('@/api/quotas.api')
    vi.mocked(quotasApi.getForCredential).mockResolvedValueOnce({ data: overview } as any)
    const useQuotas = await loadUseQuotas()
    const { quotas, loading, selectCredential, fetchQuotas } = useQuotas()

    selectCredential('c-1')
    await fetchQuotas()

    expect(quotasApi.getForCredential).toHaveBeenCalledWith('c-1')
    expect(quotas.value).toEqual(overview)
    expect(loading.value).toBe(false)
    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toEqual(overview)
  })

  it('fetchQuotas without a selected credential asks nothing', async () => {
    const { quotasApi } = await import('@/api/quotas.api')
    const useQuotas = await loadUseQuotas()
    const { quotas, fetchQuotas } = useQuotas()

    await fetchQuotas()

    expect(quotasApi.getForCredential).not.toHaveBeenCalled()
    expect(quotas.value).toBeNull()
  })

  it('fetchQuotas records a generic error and keeps previously cached numbers on failures', async () => {
    sessionStorage.setItem(KEY, JSON.stringify(overview))
    const { quotasApi } = await import('@/api/quotas.api')
    vi.mocked(quotasApi.getForCredential).mockRejectedValueOnce(new Error('network down'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const useQuotas = await loadUseQuotas()
    const { quotas, error, selectCredential, fetchQuotas } = useQuotas()

    selectCredential('c-1')
    await fetchQuotas()

    expect(error.value).toBe('Failed to fetch quotas')
    expect(quotas.value).toEqual(overview)
    consoleError.mockRestore()
  })

  describe('formattedQuotas', () => {
    it('maps the overview into display rows; an unlimited quota has no limit and 0 %', async () => {
      const useQuotas = await loadUseQuotas()
      const { quotas, formattedQuotas } = useQuotas()
      quotas.value = overview as any

      const rows = formattedQuotas.value
      expect(rows).toHaveLength(6)
      expect(rows[0]).toMatchObject({ label: 'workspace.quotas.instances', used: 2, limit: 10, percentage: 20 })
      expect(rows[2]).toMatchObject({ label: 'workspace.quotas.ram', used: 2, limit: 8, unit: 'GB' })
      // -1 is "unlimited" in OpenStack, not "over quota".
      expect(rows[4]).toMatchObject({ label: 'workspace.quotas.storage', used: 20, limit: null, percentage: 0 })
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
