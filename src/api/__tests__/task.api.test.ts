import { describe, it, expect, vi } from 'vitest'

vi.mock('@/api/axios', () => ({ default: { get: vi.fn() } }))

describe('taskApi', () => {
  it('listByDeployment() fetches tasks scoped to a deployment', async () => {
    const api = (await import('@/api/axios')).default
    const { taskApi } = await import('@/api/task.api')

    taskApi.listByDeployment('d-1')

    expect(api.get).toHaveBeenCalledWith('/tasks/deployment/d-1')
  })

  it('getById() fetches a single task', async () => {
    const api = (await import('@/api/axios')).default
    const { taskApi } = await import('@/api/task.api')

    taskApi.getById('t-1')

    expect(api.get).toHaveBeenCalledWith('/tasks/t-1')
  })
})
