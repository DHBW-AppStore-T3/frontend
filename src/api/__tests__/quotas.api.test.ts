import { describe, it, expect, vi } from 'vitest'

vi.mock('@/api/axios', () => ({ default: { get: vi.fn() } }))

describe('quotasApi', () => {
  it('getOverview() fetches the quota overview', async () => {
    const api = (await import('@/api/axios')).default
    const { quotasApi } = await import('@/api/quotas.api')

    quotasApi.getOverview()

    expect(api.get).toHaveBeenCalledWith('/quotas/overview')
  })
})
