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

  it('restartWorkload() posts to the workload restart endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { deploymentApi } = await import('@/api/deployment.api')

    deploymentApi.restartWorkload('d-1', 'team-1')

    expect(api.post).toHaveBeenCalledWith('/deployments/d-1/workloads/team-1/restart')
  })

  it('resetWorkload() posts to the workload reset endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { deploymentApi } = await import('@/api/deployment.api')

    deploymentApi.resetWorkload('d-1', 'team-1')

    expect(api.post).toHaveBeenCalledWith('/deployments/d-1/workloads/team-1/reset')
  })

  it('getMyAccess() fetches the caller-scoped access endpoint', async () => {
    const api = (await import('@/api/axios')).default
    const { deploymentApi } = await import('@/api/deployment.api')

    deploymentApi.getMyAccess('d-1')

    expect(api.get).toHaveBeenCalledWith('/deployments/d-1/my-access')
  })

  it('listResources() reads the workloads of the deployment', async () => {
    const api = (await import('@/api/axios')).default
    const { deploymentApi } = await import('@/api/deployment.api')

    deploymentApi.listResources('d-1')

    expect(api.get).toHaveBeenCalledWith('/deployments/d-1/resources')
  })
})
