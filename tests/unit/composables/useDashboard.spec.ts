import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/api/dashboard.api', () => ({ dashboardApi: { stats: vi.fn() } }))

import { dashboardApi } from '@/api/dashboard.api'
import { useDashboard } from '@/composables/useDashboard'

describe('useDashboard', () => {
  it('starts in loading state with zero counts', () => {
    const { result } = renderHook(() => useDashboard())
    expect(result.current.stats).toEqual({ deployments: 0, apps: 0, courses: 0, loading: true })
  })

  it('fetchStats fills the counts and clears loading', async () => {
    vi.mocked(dashboardApi.stats).mockResolvedValueOnce({
      data: { deployments: 3, apps: 5, courses: 2 },
    } as any)
    const { result } = renderHook(() => useDashboard())

    await act(() => result.current.fetchStats())

    expect(result.current.stats).toEqual({ deployments: 3, apps: 5, courses: 2, loading: false })
  })

  it('fetchStats rethrows and clears loading on failure', async () => {
    vi.mocked(dashboardApi.stats).mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useDashboard())

    await act(async () => {
      await expect(result.current.fetchStats()).rejects.toThrow('boom')
    })

    expect(result.current.stats.loading).toBe(false)
    spy.mockRestore()
  })
})
