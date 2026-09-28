import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

// ---------------------------------------------------------------------------
// Mock the axios instance that all API modules import from './axios'
// ---------------------------------------------------------------------------
vi.mock('@/api/axios', () => {
  const instance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  }
  return { default: instance }
})

import api from '@/api/axios'
import { appApi } from '@/api/app.api'
import { courseApi } from '@/api/course.api'
import { deploymentApi } from '@/api/deployment.api'
import { userApi } from '@/api/user.api'
import { credentialsApi } from '@/api/credentials.api'
import { quotasApi } from '@/api/quotas.api'
import { taskApi } from '@/api/task.api'
import { dashboardApi } from '@/api/dashboard.api'

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// appApi
// ---------------------------------------------------------------------------
describe('appApi', () => {
  it('list — GET /apps/ without params', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    appApi.list()
    expect(mockApi.get).toHaveBeenCalledWith('/apps/', { params: undefined })
  })

  it('list — GET /apps/ with params', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    appApi.list({ search: 'vue' } as any)
    expect(mockApi.get).toHaveBeenCalledWith('/apps/', { params: { search: 'vue' } })
  })

  it('getById — GET /apps/:id, refresh defaults to false', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    appApi.getById('app-1')
    expect(mockApi.get).toHaveBeenCalledWith('/apps/app-1', { params: { refresh: false } })
  })

  it('getById — passes refresh=true', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    appApi.getById('app-1', true)
    expect(mockApi.get).toHaveBeenCalledWith('/apps/app-1', { params: { refresh: true } })
  })

  it('create — POST /apps/', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    appApi.create({ name: 'Test' } as any)
    expect(mockApi.post).toHaveBeenCalledWith('/apps/', { name: 'Test' })
  })

  it('update — PUT /apps/:id', () => {
    mockApi.put.mockResolvedValue({ data: {} })
    appApi.update('app-1', { name: 'New' } as any)
    expect(mockApi.put).toHaveBeenCalledWith('/apps/app-1', { name: 'New' })
  })

  it('delete — DELETE /apps/:id', () => {
    mockApi.delete.mockResolvedValue({})
    appApi.delete('app-1')
    expect(mockApi.delete).toHaveBeenCalledWith('/apps/app-1')
  })

  it('getVariables — GET /apps/:id/variables', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    appApi.getVariables('app-1', 'v1.0')
    expect(mockApi.get).toHaveBeenCalledWith('/apps/app-1/variables', { params: { version: 'v1.0' } })
  })

  it('submitVersion — POST with encoded version tag', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    appApi.submitVersion('app-1', 'v1.0/rc', 'https://diff.url', 'some notes')
    expect(mockApi.post).toHaveBeenCalledWith(
      '/apps/app-1/versions/v1.0%2Frc/submit',
      { diff_url: 'https://diff.url', notes: 'some notes' },
    )
  })

  it('submitVersion — null for missing optional args', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    appApi.submitVersion('app-1', 'v1.0')
    expect(mockApi.post).toHaveBeenCalledWith(
      '/apps/app-1/versions/v1.0/submit',
      { diff_url: null, notes: null },
    )
  })

  it('withdrawVersion — DELETE submit', () => {
    mockApi.delete.mockResolvedValue({})
    appApi.withdrawVersion('app-1', 'v1.0')
    expect(mockApi.delete).toHaveBeenCalledWith('/apps/app-1/versions/v1.0/submit')
  })

  it('listVersionApprovals — GET /apps/:id/versions', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    appApi.listVersionApprovals('app-1')
    expect(mockApi.get).toHaveBeenCalledWith('/apps/app-1/versions')
  })

  it('admin.listPendingApprovals — GET /admin/apps/versions/pending', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    appApi.admin.listPendingApprovals()
    expect(mockApi.get).toHaveBeenCalledWith('/admin/apps/versions/pending')
  })

  it('admin.approveVersion — POST approve', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    appApi.admin.approveVersion('app-1', 'v1.0')
    expect(mockApi.post).toHaveBeenCalledWith('/admin/apps/app-1/versions/v1.0/approve')
  })

  it('admin.rejectVersion — POST reject with reason', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    appApi.admin.rejectVersion('app-1', 'v1.0', 'needs fixes')
    expect(mockApi.post).toHaveBeenCalledWith(
      '/admin/apps/app-1/versions/v1.0/reject',
      { rejection_reason: 'needs fixes' },
    )
  })

  it('admin.revokeVersion — POST revoke', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    appApi.admin.revokeVersion('app-1', 'v1.0', 'revoked')
    expect(mockApi.post).toHaveBeenCalledWith(
      '/admin/apps/app-1/versions/v1.0/revoke',
      { rejection_reason: 'revoked' },
    )
  })
})

// ---------------------------------------------------------------------------
// courseApi
// ---------------------------------------------------------------------------
describe('courseApi', () => {
  it('list — default skip/limit', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    courseApi.list()
    expect(mockApi.get).toHaveBeenCalledWith('/courses/', { params: { skip: 0, limit: 100 } })
  })

  it('list — custom skip/limit', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    courseApi.list(10, 20)
    expect(mockApi.get).toHaveBeenCalledWith('/courses/', { params: { skip: 10, limit: 20 } })
  })

  it('getById', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    courseApi.getById('c-1')
    expect(mockApi.get).toHaveBeenCalledWith('/courses/c-1')
  })

  it('create', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    courseApi.create({ name: 'WEB3' } as any)
    expect(mockApi.post).toHaveBeenCalledWith('/courses/', { name: 'WEB3' })
  })

  it('update', () => {
    mockApi.put.mockResolvedValue({ data: {} })
    courseApi.update('c-1', { name: 'WEB3 Updated' } as any)
    expect(mockApi.put).toHaveBeenCalledWith('/courses/c-1', { name: 'WEB3 Updated' })
  })

  it('delete', () => {
    mockApi.delete.mockResolvedValue({})
    courseApi.delete('c-1')
    expect(mockApi.delete).toHaveBeenCalledWith('/courses/c-1')
  })

  it('listMembers', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    courseApi.listMembers('c-1')
    expect(mockApi.get).toHaveBeenCalledWith('/courses/c-1/users')
  })

  it('addMembers', () => {
    mockApi.post.mockResolvedValue({ data: [] })
    courseApi.addMembers('c-1', ['u-1', 'u-2'])
    expect(mockApi.post).toHaveBeenCalledWith('/courses/c-1/users', { userIds: ['u-1', 'u-2'] })
  })

  it('removeMember', () => {
    mockApi.delete.mockResolvedValue({})
    courseApi.removeMember('c-1', 'u-1')
    expect(mockApi.delete).toHaveBeenCalledWith('/courses/c-1/users/u-1')
  })
})

// ---------------------------------------------------------------------------
// deploymentApi
// ---------------------------------------------------------------------------
describe('deploymentApi', () => {
  it('list without params', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    deploymentApi.list()
    expect(mockApi.get).toHaveBeenCalledWith('/deployments/', { params: undefined })
  })

  it('getById', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    deploymentApi.getById('d-1')
    expect(mockApi.get).toHaveBeenCalledWith('/deployments/d-1')
  })

  it('create', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    deploymentApi.create({ name: 'Deploy' } as any)
    expect(mockApi.post).toHaveBeenCalledWith('/deployments/', { name: 'Deploy' })
  })

  it('delete', () => {
    mockApi.delete.mockResolvedValue({})
    deploymentApi.delete('d-1')
    expect(mockApi.delete).toHaveBeenCalledWith('/deployments/d-1')
  })

  it('cancel', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    deploymentApi.cancel('d-1')
    expect(mockApi.post).toHaveBeenCalledWith('/deployments/d-1/cancel')
  })

  it('pause', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    deploymentApi.pause('d-1')
    expect(mockApi.post).toHaveBeenCalledWith('/deployments/d-1/pause')
  })

  it('resume', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    deploymentApi.resume('d-1')
    expect(mockApi.post).toHaveBeenCalledWith('/deployments/d-1/resume')
  })

  it('resendAccess', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    deploymentApi.resendAccess('d-1', 't-1', 'u-1')
    expect(mockApi.post).toHaveBeenCalledWith('/deployments/d-1/teams/t-1/users/u-1/resend-access')
  })

  it('getMyAccess', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    deploymentApi.getMyAccess('d-1')
    expect(mockApi.get).toHaveBeenCalledWith('/deployments/d-1/my-access')
  })

  it('listResources — refresh defaults to true', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    deploymentApi.listResources('d-1')
    expect(mockApi.get).toHaveBeenCalledWith('/deployments/d-1/resources', { params: { refresh: true } })
  })

  it('listResources — refresh=false', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    deploymentApi.listResources('d-1', { refresh: false })
    expect(mockApi.get).toHaveBeenCalledWith('/deployments/d-1/resources', { params: { refresh: false } })
  })

  it('getResourceDetail — encodes address', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    deploymentApi.getResourceDetail('d-1', 'openstack_compute_instance_v2.team["Team-A"]')
    expect(mockApi.get).toHaveBeenCalledWith(
      '/deployments/d-1/resources/openstack_compute_instance_v2.team%5B%22Team-A%22%5D',
    )
  })

  it('redeployResource — POST with encoded address', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    deploymentApi.redeployResource('d-1', 'addr/1')
    expect(mockApi.post).toHaveBeenCalledWith('/deployments/d-1/resources/addr%2F1/redeploy')
  })
})

// ---------------------------------------------------------------------------
// userApi
// ---------------------------------------------------------------------------
describe('userApi', () => {
  it('getMe', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    userApi.getMe()
    expect(mockApi.get).toHaveBeenCalledWith('/users/me')
  })

  it('list without params', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    userApi.list()
    expect(mockApi.get).toHaveBeenCalledWith('/users/', { params: undefined })
  })

  it('search — default limit 10', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    userApi.search('alice')
    expect(mockApi.get).toHaveBeenCalledWith('/users/search', { params: { query: 'alice', limit: 10 } })
  })

  it('getById', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    userApi.getById('u-1')
    expect(mockApi.get).toHaveBeenCalledWith('/users/u-1')
  })
})

// ---------------------------------------------------------------------------
// credentialsApi
// ---------------------------------------------------------------------------
describe('credentialsApi', () => {
  it('get', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    credentialsApi.get()
    expect(mockApi.get).toHaveBeenCalledWith('/me/openstack-credentials')
  })

  it('put', () => {
    mockApi.put.mockResolvedValue({ data: {} })
    credentialsApi.put({ auth_url: 'http://os' } as any)
    expect(mockApi.put).toHaveBeenCalledWith('/me/openstack-credentials', { auth_url: 'http://os' })
  })

  it('putFromYaml', () => {
    mockApi.put.mockResolvedValue({ data: {} })
    credentialsApi.putFromYaml({ yaml: 'clouds: {}' } as any)
    expect(mockApi.put).toHaveBeenCalledWith('/me/openstack-credentials/from-yaml', { yaml: 'clouds: {}' })
  })

  it('test', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    credentialsApi.test()
    expect(mockApi.post).toHaveBeenCalledWith('/me/openstack-credentials/test')
  })

  it('remove', () => {
    mockApi.delete.mockResolvedValue({})
    credentialsApi.remove()
    expect(mockApi.delete).toHaveBeenCalledWith('/me/openstack-credentials')
  })
})

// ---------------------------------------------------------------------------
// quotasApi
// ---------------------------------------------------------------------------
describe('quotasApi', () => {
  it('getOverview', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    quotasApi.getOverview()
    expect(mockApi.get).toHaveBeenCalledWith('/quotas/overview')
  })
})

// ---------------------------------------------------------------------------
// taskApi
// ---------------------------------------------------------------------------
describe('taskApi', () => {
  it('listByDeployment', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    taskApi.listByDeployment('d-1')
    expect(mockApi.get).toHaveBeenCalledWith('/tasks/deployment/d-1')
  })

  it('getById', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    taskApi.getById('t-1')
    expect(mockApi.get).toHaveBeenCalledWith('/tasks/t-1')
  })
})

// ---------------------------------------------------------------------------
// dashboardApi
// ---------------------------------------------------------------------------
describe('dashboardApi', () => {
  it('stats', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    dashboardApi.stats()
    expect(mockApi.get).toHaveBeenCalledWith('/dashboard/stats')
  })
})
