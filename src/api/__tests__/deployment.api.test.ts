import { describe, it, expect, vi } from 'vitest'

vi.mock('@/api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

describe('deploymentApi', () => {
  it('list() hits GET /deployments/ with query params', async () => {
    const api = (await import('@/api/axios')).default
    const { deploymentApi } = await import('@/api/deployment.api')

    deploymentApi.list({ status: 'success' } as any)

    expect(api.get).toHaveBeenCalledWith('/deployments/', { params: { status: 'success' } })
  })

  it('getById() fetches the deployment with relations', async () => {
    const api = (await import('@/api/axios')).default
    const { deploymentApi } = await import('@/api/deployment.api')

    deploymentApi.getById('d-1')

    expect(api.get).toHaveBeenCalledWith('/deployments/d-1')
  })

  it('create() posts the payload to /deployments/', async () => {
    const api = (await import('@/api/axios')).default
    const { deploymentApi } = await import('@/api/deployment.api')
    const payload = { name: 'New' }

    deploymentApi.create(payload as any)

    expect(api.post).toHaveBeenCalledWith('/deployments/', payload)
  })

  it('delete() deletes /deployments/:id', async () => {
    const api = (await import('@/api/axios')).default
    const { deploymentApi } = await import('@/api/deployment.api')

    deploymentApi.delete('d-1')

    expect(api.delete).toHaveBeenCalledWith('/deployments/d-1')
  })

  it('cancel() posts to the cancel endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { deploymentApi } = await import('@/api/deployment.api')

    deploymentApi.cancel('d-1')

    expect(api.post).toHaveBeenCalledWith('/deployments/d-1/cancel')
  })

  it('pause() posts to the pause endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { deploymentApi } = await import('@/api/deployment.api')

    deploymentApi.pause('d-1')

    expect(api.post).toHaveBeenCalledWith('/deployments/d-1/pause')
  })

  it('resume() posts to the resume endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { deploymentApi } = await import('@/api/deployment.api')

    deploymentApi.resume('d-1')

    expect(api.post).toHaveBeenCalledWith('/deployments/d-1/resume')
  })

  it('resendAccess() posts to the per-user resend endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { deploymentApi } = await import('@/api/deployment.api')

    deploymentApi.resendAccess('d-1', 't-1', 'u-1')

    expect(api.post).toHaveBeenCalledWith('/deployments/d-1/teams/t-1/users/u-1/resend-access')
  })

  it('getMyAccess() fetches the caller-scoped access endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { deploymentApi } = await import('@/api/deployment.api')

    deploymentApi.getMyAccess('d-1')

    expect(api.get).toHaveBeenCalledWith('/deployments/d-1/my-access')
  })

  it('listResources() defaults refresh to true', async () => {
    const api = (await import('@/api/axios')).default
    const { deploymentApi } = await import('@/api/deployment.api')

    deploymentApi.listResources('d-1')

    expect(api.get).toHaveBeenCalledWith('/deployments/d-1/resources', { params: { refresh: true } })
  })

  it('listResources() forwards an explicit refresh=false', async () => {
    const api = (await import('@/api/axios')).default
    const { deploymentApi } = await import('@/api/deployment.api')

    deploymentApi.listResources('d-1', { refresh: false })

    expect(api.get).toHaveBeenCalledWith('/deployments/d-1/resources', { params: { refresh: false } })
  })

  it('getResourceDetail() URL-encodes the terraform state address', async () => {
    const api = (await import('@/api/axios')).default
    const { deploymentApi } = await import('@/api/deployment.api')

    deploymentApi.getResourceDetail('d-1', 'openstack_compute_instance_v2.team_ide["Team-A"]')

    expect(api.get).toHaveBeenCalledWith(
      `/deployments/d-1/resources/${encodeURIComponent('openstack_compute_instance_v2.team_ide["Team-A"]')}`,
    )
  })

  it('redeployResource() posts to the redeploy endpoint with an encoded address', async () => {
    const api = (await import('@/api/axios')).default
    const { deploymentApi } = await import('@/api/deployment.api')

    deploymentApi.redeployResource('d-1', 'addr/with/slash')

    expect(api.post).toHaveBeenCalledWith(
      `/deployments/d-1/resources/${encodeURIComponent('addr/with/slash')}/redeploy`,
    )
  })
})
