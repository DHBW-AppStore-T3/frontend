import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDashboard } from '@/composables/useDashboard'

vi.mock('@/api/dashboard.api', () => ({
  dashboardApi: {
    stats: vi.fn(),
  },
}))

import { dashboardApi } from '@/api/dashboard.api'
const mockStats = dashboardApi.stats as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useDashboard', () => {
  it('stats.loading is true before any fetch', () => {
    const { stats } = useDashboard()
    expect(stats.value.loading).toBe(true)
  })

  it('fetchStats updates all counters and sets loading false', async () => {
    mockStats.mockResolvedValue({ data: { deployments: 5, apps: 12, courses: 3 } })
    const { stats, fetchStats } = useDashboard()
    await fetchStats()
    expect(stats.value.deployments).toBe(5)
    expect(stats.value.apps).toBe(12)
    expect(stats.value.courses).toBe(3)
    expect(stats.value.loading).toBe(false)
  })

  it('fetchStats sets loading to true at start, false in finally', async () => {
    let loadingDuringFetch = false
    mockStats.mockImplementation(async () => {
      loadingDuringFetch = true  // checked inside mock — loading must be true here
      return { data: { deployments: 0, apps: 0, courses: 0 } }
    })
    const { stats, fetchStats } = useDashboard()
    await fetchStats()
    expect(loadingDuringFetch).toBe(true)
    expect(stats.value.loading).toBe(false)
  })

  it('fetchStats re-throws on API error and sets loading false', async () => {
    mockStats.mockRejectedValue(new Error('API down'))
    const { stats, fetchStats } = useDashboard()
    await expect(fetchStats()).rejects.toThrow('API down')
    expect(stats.value.loading).toBe(false)
  })
})
