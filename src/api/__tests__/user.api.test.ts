import { describe, it, expect, vi } from 'vitest'

vi.mock('@/api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

describe('userApi', () => {
  it('getMe() fetches the current user', async () => {
    const api = (await import('@/api/axios')).default
    const { userApi } = await import('@/api/user.api')

    userApi.getMe()

    expect(api.get).toHaveBeenCalledWith('/users/me')
  })

  it('list() forwards query params', async () => {
    const api = (await import('@/api/axios')).default
    const { userApi } = await import('@/api/user.api')

    userApi.list({ role: 'admin' } as any)

    expect(api.get).toHaveBeenCalledWith('/users/', { params: { role: 'admin' } })
  })

  it('search() defaults limit to 10', async () => {
    const api = (await import('@/api/axios')).default
    const { userApi } = await import('@/api/user.api')

    userApi.search('max')

    expect(api.get).toHaveBeenCalledWith('/users/search', { params: { query: 'max', limit: 10 } })
  })

  it('search() forwards an explicit limit', async () => {
    const api = (await import('@/api/axios')).default
    const { userApi } = await import('@/api/user.api')

    userApi.search('max', 25)

    expect(api.get).toHaveBeenCalledWith('/users/search', { params: { query: 'max', limit: 25 } })
  })

  it('getById() fetches a specific user', async () => {
    const api = (await import('@/api/axios')).default
    const { userApi } = await import('@/api/user.api')

    userApi.getById('u-1')

    expect(api.get).toHaveBeenCalledWith('/users/u-1')
  })
})
