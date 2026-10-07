import { describe, it, expect, vi } from 'vitest'

vi.mock('@/api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

describe('credentialsApi', () => {
  it('get() fetches the masked credential status', async () => {
    const api = (await import('@/api/axios')).default
    const { credentialsApi } = await import('@/api/credentials.api')

    credentialsApi.get()

    expect(api.get).toHaveBeenCalledWith('/me/openstack-credentials')
  })

  it('put() replaces credentials with the given payload', async () => {
    const api = (await import('@/api/axios')).default
    const { credentialsApi } = await import('@/api/credentials.api')
    const payload = { cloud_name: 'x' }

    credentialsApi.put(payload as any)

    expect(api.put).toHaveBeenCalledWith('/me/openstack-credentials', payload)
  })

  it('putFromYaml() uploads the raw clouds.yaml body', async () => {
    const api = (await import('@/api/axios')).default
    const { credentialsApi } = await import('@/api/credentials.api')
    const body = { yaml: 'clouds: {}' }

    credentialsApi.putFromYaml(body as any)

    expect(api.put).toHaveBeenCalledWith('/me/openstack-credentials/from-yaml', body)
  })

  it('test() re-validates the stored credential', async () => {
    const api = (await import('@/api/axios')).default
    const { credentialsApi } = await import('@/api/credentials.api')

    credentialsApi.test()

    expect(api.post).toHaveBeenCalledWith('/me/openstack-credentials/test')
  })

  it('remove() deletes the stored credential', async () => {
    const api = (await import('@/api/axios')).default
    const { credentialsApi } = await import('@/api/credentials.api')

    credentialsApi.remove()

    expect(api.delete).toHaveBeenCalledWith('/me/openstack-credentials')
  })
})
