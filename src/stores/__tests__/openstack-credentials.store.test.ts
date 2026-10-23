import { describe, it, expect, vi, beforeEach } from 'vitest'
import { liveStore, resetStore } from '../../../tests/helpers/liveStore'
import {
  useOpenStackCredentialsStore,
  isUsable,
  selectCredentials,
  selectHasAnyCredential,
  selectHasUsableCredential,
  selectUsableCredentials,
  selectUnverifiedCredentials,
  selectFailingCredentials,
  selectIsResolved,
  selectCredentialById,
} from '../openstack-credentials.store'
import type { OpenStackCredential } from '@/types/openstack-credential'

vi.mock('@/api/credentials.api', () => ({
  credentialsApi: {
    list: vi.fn(),
    save: vi.fn(),
    saveFromYaml: vi.fn(),
    remove: vi.fn(),
    test: vi.fn(),
  },
}))

function credential(overrides: Partial<OpenStackCredential> = {}): OpenStackCredential {
  return {
    credentialId: 'c-1',
    auth_type: 'v3applicationcredential',
    auth_url: 'https://keystone.example/v3',
    project_id: 'p-1',
    project_name: 'Project One',
    project_verified: true,
    last_validated_at: '2026-10-15T08:00:00Z',
    last_validation_error: null,
    active_deployments: 0,
    ...overrides,
  }
}

function lockedError(activeDeployments = 2) {
  return {
    isAxiosError: true,
    response: {
      status: 409,
      data: { detail: { reason: 'openstack_credentials_locked', active_deployments: activeDeployments } },
    },
  }
}

describe('OpenStackCredentialsStore', () => {
  beforeEach(() => {
    resetStore(useOpenStackCredentialsStore)
    vi.clearAllMocks()
  })

  it('initializes unresolved and empty', () => {
    const store = liveStore(useOpenStackCredentialsStore)
    expect(store.credentials).toBeNull()
    expect(selectIsResolved(store)).toBe(false)
    expect(selectHasAnyCredential(store)).toBe(false)
    expect(selectHasUsableCredential(store)).toBe(false)
    expect(selectCredentials(store)).toEqual([])
  })

  describe('getters', () => {
    it('split the credentials into usable, unverified and failing', () => {
      const store = liveStore(useOpenStackCredentialsStore)
      const ok = credential()
      const old = credential({ credentialId: 'c-2', project_verified: false, project_id: 'typed' })
      const broken = credential({ credentialId: 'c-3', project_id: 'p-3', last_validation_error: 'invalid_credentials' })
      store.credentials = [ok, old, broken]

      expect(selectIsResolved(store)).toBe(true)
      expect(selectHasAnyCredential(store)).toBe(true)
      expect(selectUsableCredentials(store).map((c) => c.credentialId)).toEqual(['c-1'])
      expect(selectUnverifiedCredentials(store).map((c) => c.credentialId)).toEqual(['c-2'])
      expect(selectFailingCredentials(store).map((c) => c.credentialId)).toEqual(['c-3'])
      expect(selectHasUsableCredential(store)).toBe(true)
      expect(selectCredentialById('c-2')(store)?.project_id).toBe('typed')
      expect(selectCredentialById('nope')(store)).toBeNull()
      expect(selectCredentialById(null)(store)).toBeNull()
    })

    it('never counts an unverified credential as usable (its project id was typed)', () => {
      expect(isUsable(credential({ project_verified: false }))).toBe(false)
      expect(isUsable(credential({ last_validation_error: 'rejected' }))).toBe(false)
      expect(isUsable(credential())).toBe(true)
    })
  })

  describe('fetch', () => {
    it('stores the list from the API', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      vi.mocked(credentialsApi.list).mockResolvedValueOnce({ data: [credential()] } as any)
      const store = liveStore(useOpenStackCredentialsStore)

      const result = await store.fetch()

      expect(result).toHaveLength(1)
      expect(store.credentials).toHaveLength(1)
      expect(store.loading).toBe(false)
    })

    it('dedupes concurrent calls into a single in-flight request', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      vi.mocked(credentialsApi.list).mockResolvedValue({ data: [] } as any)
      const store = liveStore(useOpenStackCredentialsStore)

      await Promise.all([store.fetch(), store.fetch(), store.fetch()])

      expect(credentialsApi.list).toHaveBeenCalledTimes(1)
    })

    it('treats an answer that is not a list (older backend) as an error, not as data', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      vi.mocked(credentialsApi.list).mockResolvedValueOnce({ data: { has_credential: false } } as any)
      const store = liveStore(useOpenStackCredentialsStore)

      expect(await store.fetch()).toBeNull()
      expect(store.error).toContain('a list is expected')
      expect(store.credentials).toBeNull()
      expect(selectCredentials(store)).toEqual([])
    })

    it('swallows errors, records the message and resolves to null', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      vi.mocked(credentialsApi.list).mockRejectedValueOnce(new Error('boom'))
      const store = liveStore(useOpenStackCredentialsStore)

      expect(await store.fetch()).toBeNull()
      expect(store.error).toBe('boom')
      expect(selectIsResolved(store)).toBe(false)
    })
  })

  describe('save', () => {
    it('posts and re-reads the list (a replaced credential keeps its id)', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      vi.mocked(credentialsApi.save).mockResolvedValueOnce({ data: credential() } as any)
      vi.mocked(credentialsApi.list).mockResolvedValueOnce({ data: [credential()] } as any)
      const store = liveStore(useOpenStackCredentialsStore)

      const saved = await store.save({ auth_type: 'password', auth_url: 'https://k', identifier: 'u', secret: 's' })

      expect(saved.project_name).toBe('Project One')
      expect(credentialsApi.list).toHaveBeenCalledTimes(1)
      expect(store.credentials).toHaveLength(1)
    })

    it('explains a Keystone rejection and re-throws', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      vi.mocked(credentialsApi.save).mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 422, data: { detail: { reason: 'openstack_credentials_invalid', cause: 'auth_url_not_allowed' } } },
      })
      const store = liveStore(useOpenStackCredentialsStore)

      await expect(store.save({ auth_type: 'password', auth_url: 'https://evil', identifier: 'u', secret: 's' }))
        .rejects.toBeTruthy()
      expect(store.error).toContain('auth_url_not_allowed')
    })

    it('saveFromYaml posts the yaml and re-reads the list', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      vi.mocked(credentialsApi.saveFromYaml).mockResolvedValueOnce({ data: credential() } as any)
      vi.mocked(credentialsApi.list).mockResolvedValueOnce({ data: [credential()] } as any)
      const store = liveStore(useOpenStackCredentialsStore)

      await store.saveFromYaml({ clouds_yaml: 'clouds: {}' })

      expect(credentialsApi.saveFromYaml).toHaveBeenCalledWith({ clouds_yaml: 'clouds: {}' })
      expect(store.credentials).toHaveLength(1)
    })
  })

  describe('remove', () => {
    it('drops the credential from the list', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      vi.mocked(credentialsApi.remove).mockResolvedValueOnce({} as any)
      const store = liveStore(useOpenStackCredentialsStore)
      store.credentials = [credential(), credential({ credentialId: 'c-2' })]

      await store.remove('c-1')

      expect(credentialsApi.remove).toHaveBeenCalledWith('c-1')
      expect(store.credentials?.map((c) => c.credentialId)).toEqual(['c-2'])
    })

    it('reports the active deployments of a locked credential and re-reads the list', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      vi.mocked(credentialsApi.remove).mockRejectedValueOnce(lockedError(3))
      vi.mocked(credentialsApi.list).mockResolvedValueOnce({ data: [credential({ active_deployments: 3 })] } as any)
      const store = liveStore(useOpenStackCredentialsStore)
      store.credentials = [credential()]

      await expect(store.remove('c-1')).rejects.toBeTruthy()

      expect(store.error).toContain('3')
      expect(credentialsApi.list).toHaveBeenCalledTimes(1)
      expect(store.credentials?.[0]?.active_deployments).toBe(3)
    })
  })

  describe('test', () => {
    it('replaces the checked credential in the list (an old one becomes verified)', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      const verified = credential({ project_id: 'p-9', project_verified: true })
      vi.mocked(credentialsApi.test).mockResolvedValueOnce({ data: verified } as any)
      const store = liveStore(useOpenStackCredentialsStore)
      store.credentials = [credential({ project_verified: false, project_id: 'typed' })]

      const result = await store.test('c-1')

      expect(credentialsApi.test).toHaveBeenCalledWith('c-1')
      expect(result.project_id).toBe('p-9')
      expect(selectUsableCredentials(store).map((c) => c.project_id)).toEqual(['p-9'])
    })
  })

  it('reset clears the list, error and loading', () => {
    const store = liveStore(useOpenStackCredentialsStore)
    store.credentials = [credential()]
    store.error = 'x'
    store.loading = true

    store.reset()

    expect(store.credentials).toBeNull()
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })
})
