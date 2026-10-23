import { describe, it, expect, vi } from 'vitest'

vi.mock('@/api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

describe('credentialsApi', () => {
  it('list() fetches the caller\'s credentials, one per project', async () => {
    const api = (await import('@/api/axios')).default
    const { credentialsApi } = await import('@/api/credentials.api')

    credentialsApi.list()

    expect(api.get).toHaveBeenCalledWith('/me/openstack-credentials')
  })

  it('save() posts a credential (new project: 201, same project: replaced)', async () => {
    const api = (await import('@/api/axios')).default
    const { credentialsApi } = await import('@/api/credentials.api')
    const payload = { auth_type: 'v3applicationcredential', auth_url: 'https://k', identifier: 'i', secret: 's' }

    credentialsApi.save(payload as any)

    expect(api.post).toHaveBeenCalledWith('/me/openstack-credentials', payload)
    expect(api.put).not.toHaveBeenCalled()
  })

  it('saveFromYaml() posts the raw clouds.yaml body', async () => {
    const api = (await import('@/api/axios')).default
    const { credentialsApi } = await import('@/api/credentials.api')
    const body = { clouds_yaml: 'clouds: {}' }

    credentialsApi.saveFromYaml(body as any)

    expect(api.post).toHaveBeenCalledWith('/me/openstack-credentials/from-yaml', body)
  })

  it('test() re-checks one credential', async () => {
    const api = (await import('@/api/axios')).default
    const { credentialsApi } = await import('@/api/credentials.api')

    credentialsApi.test('c-1')

    expect(api.post).toHaveBeenCalledWith('/me/openstack-credentials/c-1/test')
  })

  it('remove() deletes one credential', async () => {
    const api = (await import('@/api/axios')).default
    const { credentialsApi } = await import('@/api/credentials.api')

    credentialsApi.remove('c-1')

    expect(api.delete).toHaveBeenCalledWith('/me/openstack-credentials/c-1')
  })

  it('escapes the credential id in the path', async () => {
    const api = (await import('@/api/axios')).default
    const { credentialsApi } = await import('@/api/credentials.api')

    credentialsApi.remove('../x')

    expect(api.delete).toHaveBeenCalledWith('/me/openstack-credentials/..%2Fx')
  })
})
