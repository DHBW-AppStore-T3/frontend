import { describe, it, expect, vi, beforeEach } from 'vitest'

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
import { dashboardApi } from '@/api/dashboard.api'
import { quotasApi } from '@/api/quotas.api'
import { taskApi } from '@/api/task.api'
import { openstackResourcesApi } from '@/api/openstack-resources.api'

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  vi.clearAllMocks()
})

// Only non-obvious behavior: default values, URL encoding, and specific key names.
// Trivial "calls api.verb('/path')" tests are omitted — they add no signal.

describe('appApi — non-obvious defaults & encoding', () => {
  it('getById: refresh defaults to false (not true)', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    appApi.getById('app-1')
    expect(mockApi.get).toHaveBeenCalledWith('/apps/app-1', { params: { refresh: false } })
  })

  it('getById: refresh=true is forwarded', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    appApi.getById('app-1', true)
    expect(mockApi.get).toHaveBeenCalledWith('/apps/app-1', { params: { refresh: true } })
  })

  it('submitVersion: URL-encodes "/" in version tag', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    appApi.submitVersion('app-1', 'v1.0/rc', 'https://diff.url', 'notes')
    expect(mockApi.post).toHaveBeenCalledWith(
      '/apps/app-1/versions/v1.0%2Frc/submit',
      { diff_url: 'https://diff.url', notes: 'notes' },
    )
  })

  it('submitVersion: missing optional args are null, not undefined', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    appApi.submitVersion('app-1', 'v1.0')
    expect(mockApi.post).toHaveBeenCalledWith(
      '/apps/app-1/versions/v1.0/submit',
      { diff_url: null, notes: null },
    )
  })

  it('admin.rejectVersion: uses "rejection_reason" key, not "reason"', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    appApi.admin.rejectVersion('app-1', 'v1.0', 'needs fixes')
    expect(mockApi.post).toHaveBeenCalledWith(
      '/admin/apps/app-1/versions/v1.0/reject',
      { rejection_reason: 'needs fixes' },
    )
  })
})

describe('courseApi — non-obvious defaults', () => {
  it('list: defaults to skip=0, limit=100', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    courseApi.list()
    expect(mockApi.get).toHaveBeenCalledWith('/courses/', { params: { skip: 0, limit: 100 } })
  })
})

describe('deploymentApi — non-obvious defaults & encoding', () => {
  it('listResources: refresh defaults to true (opposite of getById)', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    deploymentApi.listResources('d-1')
    expect(mockApi.get).toHaveBeenCalledWith('/deployments/d-1/resources', { params: { refresh: true } })
  })

  it('getResourceDetail: URL-encodes brackets and quotes in address', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    deploymentApi.getResourceDetail('d-1', 'openstack_compute_instance_v2.team["Team-A"]')
    expect(mockApi.get).toHaveBeenCalledWith(
      '/deployments/d-1/resources/openstack_compute_instance_v2.team%5B%22Team-A%22%5D',
    )
  })

  it('redeployResource: URL-encodes "/" in address', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    deploymentApi.redeployResource('d-1', 'addr/1')
    expect(mockApi.post).toHaveBeenCalledWith('/deployments/d-1/resources/addr%2F1/redeploy')
  })
})

describe('userApi — non-obvious defaults', () => {
  it('search: default limit is 10', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    userApi.search('alice')
    expect(mockApi.get).toHaveBeenCalledWith('/users/search', { params: { query: 'alice', limit: 10 } })
  })
})

// ---------------------------------------------------------------------------
// Additional coverage — all remaining API methods
// ---------------------------------------------------------------------------

describe('appApi — remaining methods', () => {
  it('list: passes query params', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    appApi.list({ userId: 'u-1' })
    expect(mockApi.get).toHaveBeenCalledWith('/apps/', { params: { userId: 'u-1' } })
  })

  it('create: POSTs to /apps/', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    appApi.create({ name: 'My App' } as any)
    expect(mockApi.post).toHaveBeenCalledWith('/apps/', { name: 'My App' })
  })

  it('update: PUTs to /apps/:appId', () => {
    mockApi.put.mockResolvedValue({ data: {} })
    appApi.update('app-1', { name: 'Updated' } as any)
    expect(mockApi.put).toHaveBeenCalledWith('/apps/app-1', { name: 'Updated' })
  })

  it('delete: DELETEs /apps/:appId', () => {
    mockApi.delete.mockResolvedValue({})
    appApi.delete('app-1')
    expect(mockApi.delete).toHaveBeenCalledWith('/apps/app-1')
  })

  it('getVariables: GETs variables with version param', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    appApi.getVariables('app-1', 'v2.0')
    expect(mockApi.get).toHaveBeenCalledWith('/apps/app-1/variables', { params: { version: 'v2.0' } })
  })

  it('withdrawVersion: DELETEs the submit endpoint', () => {
    mockApi.delete.mockResolvedValue({})
    appApi.withdrawVersion('app-1', 'v1.0')
    expect(mockApi.delete).toHaveBeenCalledWith('/apps/app-1/versions/v1.0/submit')
  })

  it('withdrawVersion: URL-encodes "/" in version tag', () => {
    mockApi.delete.mockResolvedValue({})
    appApi.withdrawVersion('app-1', 'v1.0/rc')
    expect(mockApi.delete).toHaveBeenCalledWith('/apps/app-1/versions/v1.0%2Frc/submit')
  })

  it('listVersionApprovals: GETs /apps/:appId/versions', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    appApi.listVersionApprovals('app-1')
    expect(mockApi.get).toHaveBeenCalledWith('/apps/app-1/versions')
  })

  it('admin.listPendingApprovals: GETs /admin/apps/versions/pending', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    appApi.admin.listPendingApprovals()
    expect(mockApi.get).toHaveBeenCalledWith('/admin/apps/versions/pending')
  })

  it('admin.approveVersion: POSTs to approve endpoint', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    appApi.admin.approveVersion('app-1', 'v1.0')
    expect(mockApi.post).toHaveBeenCalledWith('/admin/apps/app-1/versions/v1.0/approve')
  })

  it('admin.revokeVersion: uses "rejection_reason" key', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    appApi.admin.revokeVersion('app-1', 'v1.0', 'bad code')
    expect(mockApi.post).toHaveBeenCalledWith(
      '/admin/apps/app-1/versions/v1.0/revoke',
      { rejection_reason: 'bad code' },
    )
  })
})

describe('courseApi — remaining methods', () => {
  it('getById: GETs /courses/:courseId', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    courseApi.getById('c-1')
    expect(mockApi.get).toHaveBeenCalledWith('/courses/c-1')
  })

  it('create: POSTs to /courses/', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    courseApi.create({ name: 'TINF23B' } as any)
    expect(mockApi.post).toHaveBeenCalledWith('/courses/', { name: 'TINF23B' })
  })

  it('update: PUTs to /courses/:courseId', () => {
    mockApi.put.mockResolvedValue({ data: {} })
    courseApi.update('c-1', { name: 'Updated' } as any)
    expect(mockApi.put).toHaveBeenCalledWith('/courses/c-1', { name: 'Updated' })
  })

  it('delete: DELETEs /courses/:courseId', () => {
    mockApi.delete.mockResolvedValue({})
    courseApi.delete('c-1')
    expect(mockApi.delete).toHaveBeenCalledWith('/courses/c-1')
  })

  it('listMembers: GETs /courses/:courseId/users', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    courseApi.listMembers('c-1')
    expect(mockApi.get).toHaveBeenCalledWith('/courses/c-1/users')
  })

  it('addMembers: POSTs userIds to /courses/:courseId/users', () => {
    mockApi.post.mockResolvedValue({ data: [] })
    courseApi.addMembers('c-1', ['u-1', 'u-2'])
    expect(mockApi.post).toHaveBeenCalledWith('/courses/c-1/users', { userIds: ['u-1', 'u-2'] })
  })

  it('removeMember: DELETEs /courses/:courseId/users/:userId', () => {
    mockApi.delete.mockResolvedValue({})
    courseApi.removeMember('c-1', 'u-1')
    expect(mockApi.delete).toHaveBeenCalledWith('/courses/c-1/users/u-1')
  })
})

describe('deploymentApi — remaining methods', () => {
  it('list: GETs /deployments/ with params', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    deploymentApi.list({ userId: 'u-1' })
    expect(mockApi.get).toHaveBeenCalledWith('/deployments/', { params: { userId: 'u-1' } })
  })

  it('getById: GETs /deployments/:deploymentId', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    deploymentApi.getById('d-1')
    expect(mockApi.get).toHaveBeenCalledWith('/deployments/d-1')
  })

  it('create: POSTs to /deployments/', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    deploymentApi.create({ name: 'Deploy A' } as any)
    expect(mockApi.post).toHaveBeenCalledWith('/deployments/', { name: 'Deploy A' })
  })

  it('delete: DELETEs /deployments/:deploymentId', () => {
    mockApi.delete.mockResolvedValue({})
    deploymentApi.delete('d-1')
    expect(mockApi.delete).toHaveBeenCalledWith('/deployments/d-1')
  })

  it('cancel: POSTs to /deployments/:deploymentId/cancel', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    deploymentApi.cancel('d-1')
    expect(mockApi.post).toHaveBeenCalledWith('/deployments/d-1/cancel')
  })

  it('pause: POSTs to /deployments/:deploymentId/pause', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    deploymentApi.pause('d-1')
    expect(mockApi.post).toHaveBeenCalledWith('/deployments/d-1/pause')
  })

  it('resume: POSTs to /deployments/:deploymentId/resume', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    deploymentApi.resume('d-1')
    expect(mockApi.post).toHaveBeenCalledWith('/deployments/d-1/resume')
  })

  it('resendAccess: POSTs to the resend-access endpoint', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    deploymentApi.resendAccess('d-1', 'team-1', 'u-1')
    expect(mockApi.post).toHaveBeenCalledWith('/deployments/d-1/teams/team-1/users/u-1/resend-access')
  })

  it('getMyAccess: GETs /deployments/:deploymentId/my-access', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    deploymentApi.getMyAccess('d-1')
    expect(mockApi.get).toHaveBeenCalledWith('/deployments/d-1/my-access')
  })

  it('listResources: refresh defaults to true (opposite of getById)', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    deploymentApi.listResources('d-1')
    expect(mockApi.get).toHaveBeenCalledWith('/deployments/d-1/resources', { params: { refresh: true } })
  })

  it('getResourceDetail: URL-encodes brackets and quotes in address', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    deploymentApi.getResourceDetail('d-1', 'openstack_compute_instance_v2.team["Team-A"]')
    expect(mockApi.get).toHaveBeenCalledWith(
      '/deployments/d-1/resources/openstack_compute_instance_v2.team%5B%22Team-A%22%5D',
    )
  })

  it('redeployResource: URL-encodes "/" in address', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    deploymentApi.redeployResource('d-1', 'addr/1')
    expect(mockApi.post).toHaveBeenCalledWith('/deployments/d-1/resources/addr%2F1/redeploy')
  })
})

describe('userApi — remaining methods', () => {
  it('getMe: GETs /users/me', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    userApi.getMe()
    expect(mockApi.get).toHaveBeenCalledWith('/users/me')
  })

  it('list: GETs /users/ with optional params', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    userApi.list({ role: 'student' } as any)
    expect(mockApi.get).toHaveBeenCalledWith('/users/', { params: { role: 'student' } })
  })

  it('getById: GETs /users/:userId', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    userApi.getById('u-42')
    expect(mockApi.get).toHaveBeenCalledWith('/users/u-42')
  })
})

describe('credentialsApi', () => {
  it('get: GETs /me/openstack-credentials', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    credentialsApi.get()
    expect(mockApi.get).toHaveBeenCalledWith('/me/openstack-credentials')
  })

  it('put: PUTs payload to /me/openstack-credentials', () => {
    mockApi.put.mockResolvedValue({ data: {} })
    const payload = { auth_url: 'https://os.example.com', username: 'u', password: 'p', project_id: 'p', domain_name: 'D', region_name: 'R' }
    credentialsApi.put(payload as any)
    expect(mockApi.put).toHaveBeenCalledWith('/me/openstack-credentials', payload)
  })

  it('putFromYaml: PUTs to /me/openstack-credentials/from-yaml', () => {
    mockApi.put.mockResolvedValue({ data: {} })
    credentialsApi.putFromYaml({ clouds_yaml: 'yaml-content' } as any)
    expect(mockApi.put).toHaveBeenCalledWith('/me/openstack-credentials/from-yaml', { clouds_yaml: 'yaml-content' })
  })

  it('test: POSTs to /me/openstack-credentials/test', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    credentialsApi.test()
    expect(mockApi.post).toHaveBeenCalledWith('/me/openstack-credentials/test')
  })

  it('remove: DELETEs /me/openstack-credentials', () => {
    mockApi.delete.mockResolvedValue({})
    credentialsApi.remove()
    expect(mockApi.delete).toHaveBeenCalledWith('/me/openstack-credentials')
  })
})

describe('dashboardApi', () => {
  it('stats: GETs /dashboard/stats', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    dashboardApi.stats()
    expect(mockApi.get).toHaveBeenCalledWith('/dashboard/stats')
  })
})

describe('quotasApi', () => {
  it('getOverview: GETs /quotas/overview', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    quotasApi.getOverview()
    expect(mockApi.get).toHaveBeenCalledWith('/quotas/overview')
  })
})

describe('taskApi', () => {
  it('listByDeployment: GETs tasks for a deployment', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    taskApi.listByDeployment('d-1')
    expect(mockApi.get).toHaveBeenCalledWith('/tasks/deployment/d-1')
  })

  it('getById: GETs a single task', () => {
    mockApi.get.mockResolvedValue({ data: {} })
    taskApi.getById('t-99')
    expect(mockApi.get).toHaveBeenCalledWith('/tasks/t-99')
  })
})

// ---------------------------------------------------------------------------
// openstack-resources.api — non-trivial defaults and optional params
// ---------------------------------------------------------------------------
describe('openstackResourcesApi', () => {
  it('listNetworks: GETs /me/openstack/resources/networks', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    openstackResourcesApi.listNetworks()
    expect(mockApi.get).toHaveBeenCalledWith('/me/openstack/resources/networks')
  })

  it('listSubnets: GETs subnets without networkId when omitted', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    openstackResourcesApi.listSubnets()
    expect(mockApi.get).toHaveBeenCalledWith('/me/openstack/resources/subnets', { params: undefined })
  })

  it('listSubnets: passes network_id param when provided', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    openstackResourcesApi.listSubnets('net-1')
    expect(mockApi.get).toHaveBeenCalledWith(
      '/me/openstack/resources/subnets',
      { params: { network_id: 'net-1' } },
    )
  })

  it('listFlavors: GETs /me/openstack/resources/flavors', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    openstackResourcesApi.listFlavors()
    expect(mockApi.get).toHaveBeenCalledWith('/me/openstack/resources/flavors')
  })

  it('listImages: defaults to status="active"', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    openstackResourcesApi.listImages()
    expect(mockApi.get).toHaveBeenCalledWith(
      '/me/openstack/resources/images',
      { params: { status: 'active' } },
    )
  })

  it('listImages: forwards custom status filter', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    openstackResourcesApi.listImages('all')
    expect(mockApi.get).toHaveBeenCalledWith(
      '/me/openstack/resources/images',
      { params: { status: 'all' } },
    )
  })

  it('listKeypairs: GETs /me/openstack/resources/keypairs', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    openstackResourcesApi.listKeypairs()
    expect(mockApi.get).toHaveBeenCalledWith('/me/openstack/resources/keypairs')
  })

  it('listSecurityGroups: GETs the correct endpoint', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    openstackResourcesApi.listSecurityGroups()
    expect(mockApi.get).toHaveBeenCalledWith('/me/openstack/resources/security-groups')
  })

  it('listFloatingIpPools: GETs the correct endpoint', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    openstackResourcesApi.listFloatingIpPools()
    expect(mockApi.get).toHaveBeenCalledWith('/me/openstack/resources/floating-ip-pools')
  })

  it('listVolumes: GETs /me/openstack/resources/volumes', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    openstackResourcesApi.listVolumes()
    expect(mockApi.get).toHaveBeenCalledWith('/me/openstack/resources/volumes')
  })

  it('listRouters: GETs /me/openstack/resources/routers', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    openstackResourcesApi.listRouters()
    expect(mockApi.get).toHaveBeenCalledWith('/me/openstack/resources/routers')
  })

  it('listAvailabilityZones: defaults to service="compute"', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    openstackResourcesApi.listAvailabilityZones()
    expect(mockApi.get).toHaveBeenCalledWith(
      '/me/openstack/resources/availability-zones',
      { params: { service: 'compute' } },
    )
  })

  it('listAvailabilityZones: forwards custom service type', () => {
    mockApi.get.mockResolvedValue({ data: [] })
    openstackResourcesApi.listAvailabilityZones('volume')
    expect(mockApi.get).toHaveBeenCalledWith(
      '/me/openstack/resources/availability-zones',
      { params: { service: 'volume' } },
    )
  })

  it('refresh: POSTs without params when kind is omitted', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    openstackResourcesApi.refresh()
    expect(mockApi.post).toHaveBeenCalledWith(
      '/me/openstack/resources/refresh',
      null,
      { params: undefined },
    )
  })

  it('refresh: passes kind param when provided', () => {
    mockApi.post.mockResolvedValue({ data: {} })
    openstackResourcesApi.refresh('network')
    expect(mockApi.post).toHaveBeenCalledWith(
      '/me/openstack/resources/refresh',
      null,
      { params: { kind: 'network' } },
    )
  })
})
