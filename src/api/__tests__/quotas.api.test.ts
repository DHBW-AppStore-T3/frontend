import { describe, it, expect, vi } from 'vitest'

vi.mock('@/api/axios', () => ({ default: { get: vi.fn() } }))

describe('quotasApi', () => {
  it('getForCredential() fetches the quota of the credential project', async () => {
    const api = (await import('@/api/axios')).default
    const { quotasApi } = await import('@/api/quotas.api')

    quotasApi.getForCredential('c-1')

    expect(api.get).toHaveBeenCalledWith('/me/openstack-credentials/c-1/quota')
  })
})
