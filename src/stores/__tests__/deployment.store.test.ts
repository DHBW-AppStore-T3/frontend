import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDeploymentStore } from '../deployment.store'

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

vi.mock('../auth.store', () => ({
  useAuthStore: () => ({ userId: 'user-1' }),
}))

vi.mock('../app.store', () => ({
  useAppStore: () => ({ apps: [{ appId: 'app-1', name: 'Test App' }] }),
}))

describe('DeploymentStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with empty state and a default draft', () => {
    const store = useDeploymentStore()
    expect(store.deployments).toEqual([])
    expect(store.currentDeployment).toBeNull()
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.draft.appId).toBeNull()
    expect(store.draft.name).toBe('')
    expect(store.draft.variables).toEqual({})
  })

  describe('fetchDeployments', () => {
    it('sets deployments from the API', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      const deployments = [{ deploymentId: 'd-1', userId: 'user-1', status: 'success' }]
      vi.mocked(deploymentApi.list).mockResolvedValueOnce({ data: deployments } as any)

      const store = useDeploymentStore()
      await store.fetchDeployments()

      expect(store.deployments).toEqual(deployments)
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('swallows errors and records a fallback message', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.list).mockRejectedValueOnce(new Error('network down'))

      const store = useDeploymentStore()
      await expect(store.fetchDeployments()).resolves.toBeUndefined()

      expect(store.deployments).toEqual([])
      expect(store.error).toBe('network down')
      expect(store.isLoading).toBe(false)
    })
  })

  describe('fetchDeploymentById', () => {
    it('sets currentDeployment from the API', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      const deployment = { deploymentId: 'd-1', status: 'success' }
      vi.mocked(deploymentApi.getById).mockResolvedValueOnce({ data: deployment } as any)

      const store = useDeploymentStore()
      await store.fetchDeploymentById('d-1')

      expect(store.currentDeployment).toEqual(deployment)
    })

    it('treats a 404 as a soft-delete signal, not an error', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.getById).mockRejectedValueOnce({ response: { status: 404 } })

      const store = useDeploymentStore()
      store.currentDeployment = { deploymentId: 'd-1' } as any
      await store.fetchDeploymentById('d-1')

      expect(store.currentDeployment).toBeNull()
      expect(store.error).toBeNull()
    })

    it('surfaces non-404 errors through the error state', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.getById).mockRejectedValueOnce({ response: { status: 500, data: { detail: 'boom' } } })

      const store = useDeploymentStore()
      await store.fetchDeploymentById('d-1')

      expect(store.error).toBe('boom')
    })
  })

  describe('createDeployment', () => {
    it('appends the created deployment to the list and returns it', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      const created = { deploymentId: 'd-2', name: 'New' }
      vi.mocked(deploymentApi.create).mockResolvedValueOnce({ data: created } as any)

      const store = useDeploymentStore()
      const result = await store.createDeployment({ name: 'New' } as any)

      expect(result).toEqual(created)
      expect(store.deployments).toContainEqual(created)
    })

    it('re-throws on failure', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.create).mockRejectedValueOnce(new Error('rejected'))

      const store = useDeploymentStore()
      await expect(store.createDeployment({} as any)).rejects.toThrow('rejected')
      expect(store.error).toBe('rejected')
    })
  })

  describe('deleteDeployment', () => {
    it('removes the deployment from the local list', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.delete).mockResolvedValueOnce({ status: 204 } as any)

      const store = useDeploymentStore()
      store.deployments = [{ deploymentId: 'd-1' }, { deploymentId: 'd-2' }] as any

      const response = await store.deleteDeployment('d-1')

      expect(response.status).toBe(204)
      expect(store.deployments).toEqual([{ deploymentId: 'd-2' }])
    })
  })

  describe('lifecycle actions', () => {
    it('cancelDeployment delegates to the API', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.cancel).mockResolvedValueOnce({ data: { task_id: 't-1', status: 'destroying' } } as any)

      const store = useDeploymentStore()
      await store.cancelDeployment('d-1')

      expect(deploymentApi.cancel).toHaveBeenCalledWith('d-1')
    })

    it('pauseDeployment delegates to the API', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.pause).mockResolvedValueOnce({ data: { task_id: 't-1', status: 'pausing' } } as any)

      const store = useDeploymentStore()
      await store.pauseDeployment('d-1')

      expect(deploymentApi.pause).toHaveBeenCalledWith('d-1')
    })

    it('resumeDeployment delegates to the API', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.resume).mockResolvedValueOnce({ data: { task_id: 't-1', status: 'resuming' } } as any)

      const store = useDeploymentStore()
      await store.resumeDeployment('d-1')

      expect(deploymentApi.resume).toHaveBeenCalledWith('d-1')
    })
  })

  describe('getters', () => {
    it('myDeployments filters by the current user id', () => {
      const store = useDeploymentStore()
      store.deployments = [
        { deploymentId: 'd-1', userId: 'user-1' },
        { deploymentId: 'd-2', userId: 'someone-else' },
      ] as any

      expect(store.myDeployments).toEqual([{ deploymentId: 'd-1', userId: 'user-1' }])
    })

    it('deploymentsByStatus filters by the given status', () => {
      const store = useDeploymentStore()
      store.deployments = [
        { deploymentId: 'd-1', status: 'success' },
        { deploymentId: 'd-2', status: 'failed' },
      ] as any

      expect(store.deploymentsByStatus('failed')).toEqual([{ deploymentId: 'd-2', status: 'failed' }])
    })

    it('draftAppDetails resolves the app from the app store by id', () => {
      const store = useDeploymentStore()
      store.draft.appId = 'app-1'

      expect(store.draftAppDetails).toEqual({ appId: 'app-1', name: 'Test App' })
    })

    it('draftAppDetails is null when no app is selected', () => {
      const store = useDeploymentStore()
      expect(store.draftAppDetails).toBeNull()
    })

    it('draftAppDetails is null when the selected app id is unknown', () => {
      const store = useDeploymentStore()
      store.draft.appId = 'does-not-exist'
      expect(store.draftAppDetails).toBeNull()
    })
  })

  describe('resetDraft', () => {
    it('restores the draft to its defaults', () => {
      const store = useDeploymentStore()
      store.draft.name = 'mutated'
      store.draft.appId = 'app-1'

      store.resetDraft()

      expect(store.draft.name).toBe('')
      expect(store.draft.appId).toBeNull()
    })
  })

  describe('submitDraft', () => {
    it('throws when appId or name are missing', async () => {
      const store = useDeploymentStore()
      store.draft.appId = null
      store.draft.name = ''

      await expect(store.submitDraft()).rejects.toThrow('App und Name sind Pflichtfelder')
    })

    it('resolves the release tag from a plain string', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.create).mockResolvedValueOnce({ data: { deploymentId: 'd-1' } } as any)

      const store = useDeploymentStore()
      store.draft.appId = 'app-1'
      store.draft.name = 'My Deployment'
      store.draft.releaseTag = 'v1.2.3'

      await store.submitDraft()

      expect(deploymentApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ releaseTag: 'v1.2.3' }),
      )
    })

    it('resolves the release tag from an object shape', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.create).mockResolvedValueOnce({ data: { deploymentId: 'd-1' } } as any)

      const store = useDeploymentStore()
      store.draft.appId = 'app-1'
      store.draft.name = 'My Deployment'
      store.draft.releaseTag = { version: 'v9.9.9' } as any

      await store.submitDraft()

      expect(deploymentApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ releaseTag: 'v9.9.9' }),
      )
    })

    it('defaults the release tag to latest when releaseTag is empty', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.create).mockResolvedValueOnce({ data: { deploymentId: 'd-1' } } as any)

      const store = useDeploymentStore()
      store.draft.appId = 'app-1'
      store.draft.name = 'My Deployment'
      store.draft.releaseTag = '   '

      await store.submitDraft()

      expect(deploymentApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ releaseTag: 'latest' }),
      )
    })

    it('builds teams from explicit groupNames and assignments', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.create).mockResolvedValueOnce({ data: { deploymentId: 'd-1' } } as any)

      const store = useDeploymentStore()
      store.draft.appId = 'app-1'
      store.draft.name = 'My Deployment'
      store.draft.groupNames = ['Team-A', 'Team-B']
      store.draft.assignments = [['u-1', 'u-2'], ['u-3']] as any

      await store.submitDraft()

      expect(deploymentApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          teams: [
            { name: 'Team-A', userIds: ['u-1', 'u-2'] },
            { name: 'Team-B', userIds: ['u-3'] },
          ],
        }),
      )
    })

    it('auto-builds teams from studentIds when no groups are defined', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.create).mockResolvedValueOnce({ data: { deploymentId: 'd-1' } } as any)

      const store = useDeploymentStore()
      store.draft.appId = 'app-1'
      store.draft.name = 'My Deployment'
      store.draft.studentIds = ['u-1', 'u-2', 'u-3']
      store.draft.groupCount = 2

      await store.submitDraft()

      expect(deploymentApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          teams: [
            { name: 'Team-1', userIds: ['u-1', 'u-2'] },
            { name: 'Team-2', userIds: ['u-3'] },
          ],
        }),
      )
    })

    it('coerces non-string userIds to strings in teams', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.create).mockResolvedValueOnce({ data: { deploymentId: 'd-1' } } as any)

      const store = useDeploymentStore()
      store.draft.appId = 'app-1'
      store.draft.name = 'My Deployment'
      store.draft.groupNames = ['Team-A']
      store.draft.assignments = [[42, 'u-2']] as any

      await store.submitDraft()

      expect(deploymentApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ teams: [{ name: 'Team-A', userIds: ['42', 'u-2'] }] }),
      )
    })

    it('splits flat draft variables into packer/terraform by variableDefinitions', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.create).mockResolvedValueOnce({ data: { deploymentId: 'd-1' } } as any)

      const store = useDeploymentStore()
      store.draft.appId = 'app-1'
      store.draft.name = 'My Deployment'
      store.draft.variables = { image_type: 'ubuntu', flavor: 'm1.small' }
      store.draft.variableDefinitions = [
        { name: 'image_type', source: 'packer' } as any,
        { name: 'flavor', source: 'terraform' } as any,
      ]

      await store.submitDraft()

      expect(deploymentApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userInputVar: {
            packer: { image_type: 'ubuntu' },
            terraform: { flavor: 'm1.small' },
          },
        }),
      )
    })

    it('skips empty/undefined/null variable values so the HCL default applies', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.create).mockResolvedValueOnce({ data: { deploymentId: 'd-1' } } as any)

      const store = useDeploymentStore()
      store.draft.appId = 'app-1'
      store.draft.name = 'My Deployment'
      store.draft.variables = { empty_str: '  ', nullish: null, present: 'value' }
      store.draft.variableDefinitions = [
        { name: 'empty_str', source: 'terraform' } as any,
        { name: 'nullish', source: 'terraform' } as any,
        { name: 'present', source: 'terraform' } as any,
      ]

      await store.submitDraft()

      expect(deploymentApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ userInputVar: { packer: {}, terraform: { present: 'value' } } }),
      )
    })

    it('skips empty scoped (team/user) map values', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.create).mockResolvedValueOnce({ data: { deploymentId: 'd-1' } } as any)

      const store = useDeploymentStore()
      store.draft.appId = 'app-1'
      store.draft.name = 'My Deployment'
      store.draft.variables = { team_var: {} }
      store.draft.variableDefinitions = [
        { name: 'team_var', source: 'terraform', varScope: 'team' } as any,
      ]

      await store.submitDraft()

      expect(deploymentApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ userInputVar: { packer: {}, terraform: {} } }),
      )
    })

    it('skips file-typed variables (they travel through files, not userInputVar)', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.create).mockResolvedValueOnce({ data: { deploymentId: 'd-1' } } as any)

      const store = useDeploymentStore()
      store.draft.appId = 'app-1'
      store.draft.name = 'My Deployment'
      store.draft.variables = { cert: 'should-not-appear' }
      store.draft.variableDefinitions = [
        { name: 'cert', source: 'terraform', osType: 'file' } as any,
      ]

      await store.submitDraft()

      expect(deploymentApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ userInputVar: { packer: {}, terraform: {} } }),
      )
    })

    it('resolves multi-image packer variables nested under the template key', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.create).mockResolvedValueOnce({ data: { deploymentId: 'd-1' } } as any)

      const store = useDeploymentStore()
      store.draft.appId = 'app-1'
      store.draft.name = 'My Deployment'
      store.draft.variables = {
        packer: { web: { image_type: 'ubuntu' }, db: { image_type: 'debian' } },
      }
      store.draft.variableDefinitions = [
        { name: 'image_type', source: 'packer', template_key: 'web' } as any,
      ]

      await store.submitDraft()

      expect(deploymentApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userInputVar: { packer: { web: { image_type: 'ubuntu' } }, terraform: {} },
        }),
      )
    })

    it('falls back to shipping all draft variables as terraform when no definitions exist', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.create).mockResolvedValueOnce({ data: { deploymentId: 'd-1' } } as any)

      const store = useDeploymentStore()
      store.draft.appId = 'app-1'
      store.draft.name = 'My Deployment'
      store.draft.variables = { anything: 'goes' }
      store.draft.variableDefinitions = undefined as any

      await store.submitDraft()

      expect(deploymentApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ userInputVar: { packer: {}, terraform: { anything: 'goes' } } }),
      )
    })

    it('includes only filled file-upload slots under payload.files', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.create).mockResolvedValueOnce({ data: { deploymentId: 'd-1' } } as any)

      const store = useDeploymentStore()
      store.draft.appId = 'app-1'
      store.draft.name = 'My Deployment'
      store.draft.fileUploads = {
        cert: {
          default: { content_b64: 'abc123' },
          empty: null as any,
        },
      } as any

      await store.submitDraft()

      expect(deploymentApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ files: { cert: { default: { content_b64: 'abc123' } } } }),
      )
    })

    it('omits payload.files entirely when there are no filled slots', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      vi.mocked(deploymentApi.create).mockResolvedValueOnce({ data: { deploymentId: 'd-1' } } as any)

      const store = useDeploymentStore()
      store.draft.appId = 'app-1'
      store.draft.name = 'My Deployment'

      await store.submitDraft()

      const payload = vi.mocked(deploymentApi.create).mock.calls[0]![0]
      expect(payload).not.toHaveProperty('files')
    })

    it('returns the created deployment', async () => {
      const { deploymentApi } = await import('@/api/deployment.api')
      const created = { deploymentId: 'd-99' }
      vi.mocked(deploymentApi.create).mockResolvedValueOnce({ data: created } as any)

      const store = useDeploymentStore()
      store.draft.appId = 'app-1'
      store.draft.name = 'My Deployment'

      const result = await store.submitDraft()

      expect(result).toEqual(created)
    })
  })
})
