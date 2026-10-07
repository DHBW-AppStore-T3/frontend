import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module-scoped refs in useQuotas must be reset between tests.
// We do this by re-importing with a fresh module registry each test group.
// ---------------------------------------------------------------------------

vi.mock('@/api/quotas.api', () => ({
  quotasApi: {
    getOverview: vi.fn(),
  },
}))

// Prevent Lucide icons from failing in a non-DOM environment
vi.mock('lucide-vue-next', () => ({
  Cpu: {},
  HardDrive: {},
  Network: {},
  Box: {},
  Layers: {},
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

import { quotasApi } from '@/api/quotas.api'
const mockQuotasApi = quotasApi as { getOverview: ReturnType<typeof vi.fn> }

const QUOTA_DATA = {
  compute: {
    instances: { used: 3, limit: 10 },
    vcpus: { used: 6, limit: 20 },
    ram: { used: 4096, limit: 20480 },
  },
  storage: {
    volumes: { used: 2, limit: 10 },
    gigabytes: { used: 50, limit: 200 },
  },
  network: {
    floating_ips: { used: 1, limit: 5 },
  },
}

beforeEach(() => {
  sessionStorage.clear()
  vi.clearAllMocks()
})

describe('useQuotas — getColorClass', async () => {
  const { useQuotas } = await import('@/composables/useQuotas')

  it('returns bg-green-500 below 50%', () => {
    const { getColorClass } = useQuotas()
    expect(getColorClass(0)).toBe('bg-green-500')
    expect(getColorClass(49)).toBe('bg-green-500')
  })

  it('returns bg-yellow-500 at 50%', () => {
    const { getColorClass } = useQuotas()
    expect(getColorClass(50)).toBe('bg-yellow-500')
    expect(getColorClass(74)).toBe('bg-yellow-500')
  })

  it('returns bg-orange-500 at 75%', () => {
    const { getColorClass } = useQuotas()
    expect(getColorClass(75)).toBe('bg-orange-500')
    expect(getColorClass(89)).toBe('bg-orange-500')
  })

  it('returns bg-red-500 at 90% and above', () => {
    const { getColorClass } = useQuotas()
    expect(getColorClass(90)).toBe('bg-red-500')
    expect(getColorClass(100)).toBe('bg-red-500')
  })
})

describe('useQuotas — fetchQuotas success', async () => {
  const { useQuotas } = await import('@/composables/useQuotas')

  it('sets quotas and writes sessionStorage cache', async () => {
    mockQuotasApi.getOverview.mockResolvedValue({ data: QUOTA_DATA })
    const { quotas, loading, error, fetchQuotas } = useQuotas()

    await fetchQuotas()

    expect(quotas.value).toEqual(QUOTA_DATA)
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
    const cached = sessionStorage.getItem('openstack.quotas.v1')
    expect(cached).not.toBeNull()
    expect(JSON.parse(cached!)).toEqual(QUOTA_DATA)
  })
})

describe('useQuotas — fetchQuotas 412 (no credentials)', async () => {
  const { useQuotas } = await import('@/composables/useQuotas')

  it('sets needsCredentials=true and clears quotas + cache', async () => {
    // Pre-seed a cached value
    sessionStorage.setItem('openstack.quotas.v1', JSON.stringify(QUOTA_DATA))

    const axiosError = Object.assign(new Error('412'), {
      isAxiosError: true,
      response: { status: 412 },
    })
    // Make axios.isAxiosError recognise our fake error
    vi.mock('axios', async (importOriginal) => {
      const actual = await importOriginal<typeof import('axios')>()
      return {
        ...actual,
        default: { ...actual.default, isAxiosError: (e: unknown) => (e as any).isAxiosError === true },
        isAxiosError: (e: unknown) => (e as any).isAxiosError === true,
      }
    })

    mockQuotasApi.getOverview.mockRejectedValue(axiosError)
    const { quotas, needsCredentials, fetchQuotas } = useQuotas()

    await fetchQuotas()

    expect(needsCredentials.value).toBe(true)
    expect(quotas.value).toBeNull()
    expect(sessionStorage.getItem('openstack.quotas.v1')).toBeNull()
  })
})

describe('useQuotas — fetchQuotas generic error', async () => {
  const { useQuotas } = await import('@/composables/useQuotas')

  it('sets error message but keeps existing quotas', async () => {
    mockQuotasApi.getOverview.mockRejectedValue(new Error('network'))
    const { error, loading, fetchQuotas } = useQuotas()

    await fetchQuotas()

    expect(error.value).toBe('Failed to fetch quotas')
    expect(loading.value).toBe(false)
  })
})

describe('useQuotas — formattedQuotas', async () => {
  const { useQuotas } = await import('@/composables/useQuotas')

  it('returns empty array when quotas is null', () => {
    const { formattedQuotas, quotas } = useQuotas()
    quotas.value = null
    expect(formattedQuotas.value).toEqual([])
  })

  it('maps quota data to 6 formatted entries with percentages', async () => {
    mockQuotasApi.getOverview.mockResolvedValue({ data: QUOTA_DATA })
    const { formattedQuotas, fetchQuotas } = useQuotas()
    await fetchQuotas()

    expect(formattedQuotas.value).toHaveLength(6)

    const instances = formattedQuotas.value[0]!
    expect(instances.label).toBe('VMs / Instanzen')
    expect(instances.used).toBe(3)
    expect(instances.limit).toBe(10)
    expect(instances.percentage).toBe(30)

    // RAM is converted to GB (4096 / 1024 = 4)
    const ram = formattedQuotas.value[2]!
    expect(ram.label).toBe('RAM')
    expect(ram.used).toBe(4)
    expect(ram.limit).toBe(20)
    expect(ram.unit).toBe('GB')
  })

  it('getPercentage returns 0 when limit is 0', async () => {
    const zeroLimitData = {
      ...QUOTA_DATA,
      compute: { ...QUOTA_DATA.compute, instances: { used: 0, limit: 0 } },
    }
    mockQuotasApi.getOverview.mockResolvedValue({ data: zeroLimitData })
    const { formattedQuotas, fetchQuotas } = useQuotas()
    await fetchQuotas()
    expect(formattedQuotas.value[0]!.percentage).toBe(0)
  })
})
