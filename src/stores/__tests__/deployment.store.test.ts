import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDeploymentStore } from '@/stores/deployment.store'

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@/api/deployment.api', () => ({
  deploymentApi: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userId: 'user-me', isTeacherOrAdmin: false }),
}))

vi.mock('@/stores/app.store', () => ({
  useAppStore: () => ({ apps: [] }),
}))

import { deploymentApi } from '@/api/deployment.api'
const mockApi = deploymentApi as Record<string, ReturnType<typeof vi.fn>>

const D1 = { deploymentId: 'd-1', name: 'Deploy A', status: 'success', userId: 'user-me' }
const D2 = { deploymentId: 'd-2', name: 'Deploy B', status: 'running', userId: 'other-user' }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('deployment.store — fetchDeployments', () => {
  it('populates deployments list on success', async () => {
    mockApi.list.mockResolvedValue({ data: [D1, D2] })
    const store = useDeploymentStore()
    await store.fetchDeployments()
    expect(store.deployments).toEqual([D1, D2])
    expect(store.isLoading).toBe(false)
  })

  it('does not rethrow on failure — swallows error', async () => {
    mockApi.list.mockRejectedValue(new Error('500'))
    const store = useDeploymentStore()
    await expect(store.fetchDeployments()).resolves.toBeUndefined()
    expect(store.error).toBeTruthy()
  })
})

describe('deployment.store — fetchDeploymentById', () => {
  it('sets currentDeployment', async () => {
    mockApi.getById.mockResolvedValue({ data: D1 })
    const store = useDeploymentStore()
    await store.fetchDeploymentById('d-1')
    expect(store.currentDeployment).toEqual(D1)
  })

  it('sets currentDeployment to null on 404 (soft-deleted)', async () => {
    const err = { response: { status: 404 } }
    mockApi.getById.mockRejectedValue(err)
    const store = useDeploymentStore()
    store.currentDeployment = D1 as any
    await store.fetchDeploymentById('d-1')
    expect(store.currentDeployment).toBeNull()
  })

  it('swallows non-404 errors without rethrowing', async () => {
    mockApi.getById.mockRejectedValue(new Error('502'))
    const store = useDeploymentStore()
    await expect(store.fetchDeploymentById('d-1')).resolves.toBeUndefined()
  })
})

describe('deployment.store — createDeployment', () => {
  it('appends and returns new deployment', async () => {
    mockApi.create.mockResolvedValue({ data: D1 })
    const store = useDeploymentStore()
    const result = await store.createDeployment({ name: 'Deploy A' } as any)
    expect(result).toEqual(D1)
    expect(store.deployments).toContainEqual(D1)
  })
})

describe('deployment.store — deleteDeployment', () => {
  it('removes deployment from list', async () => {
    mockApi.delete.mockResolvedValue({ status: 204 })
    const store = useDeploymentStore()
    store.deployments = [D1 as any, D2 as any]
    await store.deleteDeployment('d-1')
    expect(store.deployments).toEqual([D2])
  })
})

describe('deployment.store — action wrappers', () => {
  it('cancelDeployment calls cancel API', async () => {
    mockApi.cancel.mockResolvedValue({ data: { task_id: 't-1', status: 'destroying' } })
    const store = useDeploymentStore()
    await store.cancelDeployment('d-1')
    expect(mockApi.cancel).toHaveBeenCalledWith('d-1')
  })

  it('pauseDeployment calls pause API', async () => {
    mockApi.pause.mockResolvedValue({ data: { task_id: 't-2', status: 'pausing' } })
    const store = useDeploymentStore()
    await store.pauseDeployment('d-1')
    expect(mockApi.pause).toHaveBeenCalledWith('d-1')
  })

  it('resumeDeployment calls resume API', async () => {
    mockApi.resume.mockResolvedValue({ data: { task_id: 't-3', status: 'resuming' } })
    const store = useDeploymentStore()
    await store.resumeDeployment('d-1')
    expect(mockApi.resume).toHaveBeenCalledWith('d-1')
  })
})

describe('deployment.store — getters', () => {
  it('myDeployments filters by current userId', () => {
    const store = useDeploymentStore()
    store.deployments = [D1 as any, D2 as any]
    expect(store.myDeployments).toEqual([D1])
  })

  it('deploymentsByStatus returns matching deployments', () => {
    const store = useDeploymentStore()
    store.deployments = [D1 as any, D2 as any]
    expect(store.deploymentsByStatus('success')).toEqual([D1])
    expect(store.deploymentsByStatus('running')).toEqual([D2])
    expect(store.deploymentsByStatus('failed' as any)).toEqual([])
  })
})

describe('deployment.store — resetDraft', () => {
  it('restores default draft state', () => {
    const store = useDeploymentStore()
    store.draft.name = 'Modified'
    store.draft.appId = 'app-999'
    store.resetDraft()
    expect(store.draft.name).toBe('')
    expect(store.draft.appId).toBeNull()
  })
})

describe('deployment.store — submitDraft', () => {
  it('throws when appId or name is missing', async () => {
    const store = useDeploymentStore()
    store.draft.appId = null
    store.draft.name = ''
    await expect(store.submitDraft()).rejects.toThrow()
  })

  it('builds payload and calls createDeployment', async () => {
    mockApi.create.mockResolvedValue({ data: D1 })
    const store = useDeploymentStore()
    store.draft.appId = 'app-1'
    store.draft.name = 'My Deploy'
    store.draft.releaseTag = 'v1.0'
    store.draft.variableDefinitions = []
    store.draft.groupNames = []
    store.draft.assignments = []

    await store.submitDraft()

    expect(mockApi.create).toHaveBeenCalledOnce()
    const payload = mockApi.create.mock.calls[0][0]
    expect(payload.name).toBe('My Deploy')
    expect(payload.appId).toBe('app-1')
    expect(payload.releaseTag).toBe('v1.0')
  })

  it('uses releaseTag object.version when tag is an object', async () => {
    mockApi.create.mockResolvedValue({ data: D1 })
    const store = useDeploymentStore()
    store.draft.appId = 'app-1'
    store.draft.name = 'Deploy'
    ;(store.draft as any).releaseTag = { version: 'v2.0' }
    store.draft.variableDefinitions = []

    await store.submitDraft()

    const payload = mockApi.create.mock.calls[0][0]
    expect(payload.releaseTag).toBe('v2.0')
  })

  it('skips file-typed variables in userInputVar', async () => {
    mockApi.create.mockResolvedValue({ data: D1 })
    const store = useDeploymentStore()
    store.draft.appId = 'app-1'
    store.draft.name = 'Deploy'
    store.draft.releaseTag = 'v1.0'
    store.draft.variableDefinitions = [
      { name: 'my_file', source: 'terraform', osType: 'file' } as any,
      { name: 'region', source: 'terraform', osType: 'string' } as any,
    ]
    ;(store.draft.variables as any) = { region: 'eu-west-1' }

    await store.submitDraft()

    const payload = mockApi.create.mock.calls[0][0]
    expect(payload.userInputVar.terraform).not.toHaveProperty('my_file')
    expect(payload.userInputVar.terraform).toHaveProperty('region', 'eu-west-1')
  })

  it('uses releaseTag.name when .version is absent', async () => {
    mockApi.create.mockResolvedValue({ data: D1 })
    const store = useDeploymentStore()
    store.draft.appId = 'app-1'
    store.draft.name = 'Deploy'
    ;(store.draft as any).releaseTag = { name: 'v3.0' }  // no .version field
    store.draft.variableDefinitions = []

    await store.submitDraft()

    const payload = mockApi.create.mock.calls[0][0]
    expect(payload.releaseTag).toBe('v3.0')
  })

  it('falls back to terraform when variableDefinitions is not an array', async () => {
    mockApi.create.mockResolvedValue({ data: D1 })
    const store = useDeploymentStore()
    store.draft.appId = 'app-1'
    store.draft.name = 'Deploy'
    store.draft.releaseTag = 'v1.0'
    ;(store.draft.variableDefinitions as any) = null
    ;(store.draft.variables as any) = { region: 'us-east-1', size: 'medium' }

    await store.submitDraft()

    const payload = mockApi.create.mock.calls[0][0]
    expect(payload.userInputVar.terraform).toEqual({ region: 'us-east-1', size: 'medium' })
  })

  it('builds teams from groupNames + assignments', async () => {
    mockApi.create.mockResolvedValue({ data: D1 })
    const store = useDeploymentStore()
    store.draft.appId = 'app-1'
    store.draft.name = 'Deploy'
    store.draft.releaseTag = 'v1.0'
    store.draft.variableDefinitions = []
    store.draft.groupNames = ['Team-A', 'Team-B']
    ;(store.draft.assignments as any) = [['u-1', 'u-2'], ['u-3']]

    await store.submitDraft()

    const { teams } = mockApi.create.mock.calls[0][0]
    expect(teams).toEqual([
      { name: 'Team-A', userIds: ['u-1', 'u-2'] },
      { name: 'Team-B', userIds: ['u-3'] },
    ])
  })

  it('falls back to missing assignment slot → empty userIds', async () => {
    mockApi.create.mockResolvedValue({ data: D1 })
    const store = useDeploymentStore()
    store.draft.appId = 'app-1'
    store.draft.name = 'Deploy'
    store.draft.releaseTag = 'v1.0'
    store.draft.variableDefinitions = []
    store.draft.groupNames = ['Team-A', 'Team-B']
    ;(store.draft.assignments as any) = [['u-1']]  // Team-B slot missing

    await store.submitDraft()

    const { teams } = mockApi.create.mock.calls[0][0]
    expect(teams[1]).toEqual({ name: 'Team-B', userIds: [] })
  })

  it('auto-splits studentIds into teams when groupNames is empty', async () => {
    mockApi.create.mockResolvedValue({ data: D1 })
    const store = useDeploymentStore()
    store.draft.appId = 'app-1'
    store.draft.name = 'Deploy'
    store.draft.releaseTag = 'v1.0'
    store.draft.variableDefinitions = []
    store.draft.groupNames = []
    store.draft.assignments = []
    store.draft.studentIds = ['u-1', 'u-2', 'u-3', 'u-4', 'u-5']
    store.draft.groupCount = 2

    await store.submitDraft()

    const { teams } = mockApi.create.mock.calls[0][0]
    // 5 students / 2 groups: remainder=1 → group-0 gets 3, group-1 gets 2
    expect(teams).toHaveLength(2)
    expect(teams[0]).toEqual({ name: 'Team-1', userIds: ['u-1', 'u-2', 'u-3'] })
    expect(teams[1]).toEqual({ name: 'Team-2', userIds: ['u-4', 'u-5'] })
  })

  it('skips scoped variable (team/user) with empty object value', async () => {
    mockApi.create.mockResolvedValue({ data: D1 })
    const store = useDeploymentStore()
    store.draft.appId = 'app-1'
    store.draft.name = 'Deploy'
    store.draft.releaseTag = 'v1.0'
    store.draft.variableDefinitions = [
      { name: 'user_cfg', source: 'terraform', osType: 'object', varScope: 'user' } as any,
      { name: 'region', source: 'terraform', osType: 'string' } as any,
    ]
    ;(store.draft.variables as any) = { user_cfg: {}, region: 'eu-west-1' }

    await store.submitDraft()

    const payload = mockApi.create.mock.calls[0][0]
    expect(payload.userInputVar.terraform).not.toHaveProperty('user_cfg')
    expect(payload.userInputVar.terraform).toHaveProperty('region', 'eu-west-1')
  })

  it('multi-image packer: routes nested packer vars under template_key', async () => {
    mockApi.create.mockResolvedValue({ data: D1 })
    const store = useDeploymentStore()
    store.draft.appId = 'app-1'
    store.draft.name = 'Deploy'
    store.draft.releaseTag = 'v1.0'
    store.draft.variableDefinitions = [
      { name: 'image_name', source: 'packer', osType: 'string', template_key: 'ubuntu' } as any,
    ]
    // Multi-image layout: variables.packer is an object whose values are objects
    ;(store.draft.variables as any) = {
      packer: { ubuntu: { image_name: 'my-ubuntu-22.04' } },
    }

    await store.submitDraft()

    const payload = mockApi.create.mock.calls[0][0]
    expect(payload.userInputVar.packer).toEqual({ ubuntu: { image_name: 'my-ubuntu-22.04' } })
  })

  it('file uploads: only slots with content_b64 included; empty map → no files key', async () => {
    mockApi.create.mockResolvedValue({ data: D1 })
    const store = useDeploymentStore()
    store.draft.appId = 'app-1'
    store.draft.name = 'Deploy'
    store.draft.releaseTag = 'v1.0'
    store.draft.variableDefinitions = []
    ;(store.draft.fileUploads as any) = {
      ssh_key: {
        global: { content_b64: 'abc123', filename: 'key.pem' },
        empty_slot: null,  // no content_b64 → filtered out
      },
      never_filled: {},  // all slots empty → entire var dropped
    }

    await store.submitDraft()

    const payload = mockApi.create.mock.calls[0][0]
    expect(payload.files).toBeDefined()
    expect(payload.files.ssh_key).toEqual({ global: { content_b64: 'abc123', filename: 'key.pem' } })
    expect(payload.files.ssh_key).not.toHaveProperty('empty_slot')
    expect(payload.files).not.toHaveProperty('never_filled')
  })

  it('payload.files is omitted entirely when no uploads have content_b64', async () => {
    mockApi.create.mockResolvedValue({ data: D1 })
    const store = useDeploymentStore()
    store.draft.appId = 'app-1'
    store.draft.name = 'Deploy'
    store.draft.releaseTag = 'v1.0'
    store.draft.variableDefinitions = []
    ;(store.draft.fileUploads as any) = { ssh_key: { global: null } }

    await store.submitDraft()

    const payload = mockApi.create.mock.calls[0][0]
    expect(payload).not.toHaveProperty('files')
  })
})
