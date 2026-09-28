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
