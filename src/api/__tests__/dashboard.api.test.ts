import { describe, it, expect, vi } from 'vitest'

vi.mock('@/api/axios', () => ({ default: { get: vi.fn() } }))

describe('dashboardApi', () => {
  it('stats() fetches dashboard statistics', async () => {
    const api = (await import('@/api/axios')).default
    const { dashboardApi } = await import('@/api/dashboard.api')

    dashboardApi.stats()

    expect(api.get).toHaveBeenCalledWith('/dashboard/stats')
  })
})
