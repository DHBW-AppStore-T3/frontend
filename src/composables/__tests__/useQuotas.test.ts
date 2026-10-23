import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/api/quotas.api', () => ({ quotasApi: { getForCredential: vi.fn() } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

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

// Fresh module (and thus fresh module-scoped store) per test.
async function setup() {
  const mod = await import('../useQuotas')
  const hook = renderHook(() => mod.useQuotas())
  return {
    get current() {
      return hook.result.current
    },
    seed: (value: unknown) => act(() => mod.useQuotaStore.setState({ quotas: value as never })),
  }
}

beforeEach(() => {
  vi.resetModules()
  sessionStorage.clear()
  vi.clearAllMocks()
})

describe('useQuotas', () => {
  it('starts with nothing selected and no quotas', async () => {
    const q = await setup()

    expect(q.current.credentialId).toBeNull()
    expect(q.current.quotas).toBeNull()
    expect(q.current.hasCachedQuotas).toBe(false)
    expect(q.current.formattedQuotas).toEqual([])
  })

  it('selecting a credential shows its cached numbers first', async () => {
    sessionStorage.setItem(KEY, JSON.stringify(overview))
    const q = await setup()

    act(() => q.current.selectCredential('c-1'))

    expect(q.current.quotas).toEqual(overview)
    expect(q.current.hasCachedQuotas).toBe(true)
  })

  it('tolerates corrupted sessionStorage content', async () => {
    sessionStorage.setItem(KEY, '{not json')
    const q = await setup()

    act(() => q.current.selectCredential('c-1'))

    expect(q.current.quotas).toBeNull()
  })

  it("fetchQuotas asks for the selected credential's project and caches per credential", async () => {
    const { quotasApi } = await import('@/api/quotas.api')
    vi.mocked(quotasApi.getForCredential).mockResolvedValueOnce({ data: overview } as never)
    const q = await setup()

    act(() => q.current.selectCredential('c-1'))
    await act(() => q.current.fetchQuotas())

    expect(quotasApi.getForCredential).toHaveBeenCalledWith('c-1')
    expect(q.current.quotas).toEqual(overview)
    expect(q.current.loading).toBe(false)
    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toEqual(overview)
  })

  it('fetchQuotas without a selected credential asks nothing', async () => {
    const { quotasApi } = await import('@/api/quotas.api')
    const q = await setup()

    await act(() => q.current.fetchQuotas())

    expect(quotasApi.getForCredential).not.toHaveBeenCalled()
    expect(q.current.quotas).toBeNull()
  })

  it('ignores an answer for a credential that was deselected meanwhile', async () => {
    const { quotasApi } = await import('@/api/quotas.api')
    let resolve: (value: unknown) => void = () => {}
    vi.mocked(quotasApi.getForCredential).mockReturnValueOnce(new Promise((r) => (resolve = r)) as never)
    const q = await setup()

    act(() => q.current.selectCredential('c-1'))
    const pending = act(() => q.current.fetchQuotas())
    act(() => q.current.selectCredential('c-2'))
    resolve({ data: overview })
    await pending

    expect(q.current.quotas).toBeNull()
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it('fetchQuotas records a generic error and keeps previously cached numbers on failures', async () => {
    sessionStorage.setItem(KEY, JSON.stringify(overview))
    const { quotasApi } = await import('@/api/quotas.api')
    vi.mocked(quotasApi.getForCredential).mockRejectedValueOnce(new Error('network down'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const q = await setup()

    act(() => q.current.selectCredential('c-1'))
    await act(() => q.current.fetchQuotas())

    expect(q.current.error).toBe('Failed to fetch quotas')
    expect(q.current.quotas).toEqual(overview)
    consoleError.mockRestore()
  })

  describe('formattedQuotas', () => {
    it('maps the overview into display rows; an unlimited quota has no limit and 0 %', async () => {
      const q = await setup()
      await q.seed(overview)

      const rows = q.current.formattedQuotas
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
      const q = await setup()
      expect(q.current.getColorClass(pct)).toBe(expected)
    })
  })
})
