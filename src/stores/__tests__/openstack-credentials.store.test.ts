import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useOpenStackCredentialsStore } from '../openstack-credentials.store'

vi.mock('@/api/credentials.api', () => ({
  credentialsApi: {
    get: vi.fn(),
    put: vi.fn(),
    putFromYaml: vi.fn(),
    remove: vi.fn(),
    test: vi.fn(),
  },
}))

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
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('initializes with empty state', () => {
    const store = useOpenStackCredentialsStore()
    expect(store.status).toBeNull()
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  describe('getters', () => {
    it('reflect an unresolved (never-fetched) state', () => {
      const store = useOpenStackCredentialsStore()
      expect(store.isResolved).toBe(false)
      expect(store.hasCredential).toBe(false)
      expect(store.isValidated).toBe(false)
      expect(store.isLocked).toBe(false)
      expect(store.activeDeployments).toBe(0)
      expect(store.lastError).toBeNull()
    })

    it('reflect a resolved, valid credential', () => {
      const store = useOpenStackCredentialsStore()
      store.status = {
        has_credential: true,
        last_validated_at: '2026-01-01T00:00:00Z',
        last_validation_error: null,
        is_locked: false,
        active_deployments: 0,
      } as any

      expect(store.isResolved).toBe(true)
      expect(store.hasCredential).toBe(true)
      expect(store.isValidated).toBe(true)
      expect(store.lastError).toBeNull()
    })

    it('reflect a credential that failed validation', () => {
      const store = useOpenStackCredentialsStore()
      store.status = {
        has_credential: true,
        last_validated_at: '2026-01-01T00:00:00Z',
        last_validation_error: 'invalid token',
        is_locked: false,
        active_deployments: 0,
      } as any

      expect(store.isValidated).toBe(false)
      expect(store.lastError).toBe('invalid token')
    })

    it('reflect a locked credential with active deployments', () => {
      const store = useOpenStackCredentialsStore()
      store.status = { has_credential: true, is_locked: true, active_deployments: 3 } as any

      expect(store.isLocked).toBe(true)
      expect(store.activeDeployments).toBe(3)
    })
  })

  describe('fetch', () => {
    it('sets status from the API', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      const status = { has_credential: true }
      vi.mocked(credentialsApi.get).mockResolvedValueOnce({ data: status } as any)

      const store = useOpenStackCredentialsStore()
      const result = await store.fetch()

      expect(result).toEqual(status)
      expect(store.status).toEqual(status)
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('dedupes concurrent calls into a single in-flight request', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      let resolve: (v: any) => void
      vi.mocked(credentialsApi.get).mockReturnValueOnce(
        new Promise((r) => { resolve = r }) as any,
      )

      const store = useOpenStackCredentialsStore()
      const first = store.fetch()
      const second = store.fetch()

      resolve!({ data: { has_credential: false } })
      const [a, b] = await Promise.all([first, second])

      expect(credentialsApi.get).toHaveBeenCalledTimes(1)
      expect(a).toEqual(b)
    })

    it('swallows errors, records the message and resolves to null', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      vi.mocked(credentialsApi.get).mockRejectedValueOnce(new Error('offline'))

      const store = useOpenStackCredentialsStore()
      const result = await store.fetch()

      expect(result).toBeNull()
      expect(store.error).toBe('offline')
      expect(store.loading).toBe(false)
    })

    it('surfaces a locked-credential message with the deployment count', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      vi.mocked(credentialsApi.get).mockRejectedValueOnce(lockedError(5))

      const store = useOpenStackCredentialsStore()
      await store.fetch()

      expect(store.error).toBe('Credentials gesperrt — 5 aktive(s) Deployment(s)')
    })

    it('allows re-fetching after a prior call has settled', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      vi.mocked(credentialsApi.get).mockResolvedValueOnce({ data: { has_credential: false } } as any)
      vi.mocked(credentialsApi.get).mockResolvedValueOnce({ data: { has_credential: true } } as any)

      const store = useOpenStackCredentialsStore()
      await store.fetch()
      await store.fetch()

      expect(credentialsApi.get).toHaveBeenCalledTimes(2)
      expect(store.status).toEqual({ has_credential: true })
    })
  })

  describe('save', () => {
    it('updates status on success', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      const status = { has_credential: true }
      vi.mocked(credentialsApi.put).mockResolvedValueOnce({ data: status } as any)

      const store = useOpenStackCredentialsStore()
      const result = await store.save({ cloud_name: 'x' } as any)

      expect(result).toEqual(status)
      expect(store.status).toEqual(status)
    })

    it('re-throws on failure and records the error', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      vi.mocked(credentialsApi.put).mockRejectedValueOnce(new Error('bad payload'))

      const store = useOpenStackCredentialsStore()
      await expect(store.save({} as any)).rejects.toThrow('bad payload')
      expect(store.error).toBe('bad payload')
      expect(store.loading).toBe(false)
    })

    it('refreshes status via fetch() when save fails due to a lock', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      vi.mocked(credentialsApi.put).mockRejectedValueOnce(lockedError(1))
      vi.mocked(credentialsApi.get).mockResolvedValueOnce({ data: { has_credential: true, is_locked: true } } as any)

      const store = useOpenStackCredentialsStore()
      await expect(store.save({} as any)).rejects.toBeTruthy()

      expect(credentialsApi.get).toHaveBeenCalledTimes(1)
      expect(store.status).toEqual({ has_credential: true, is_locked: true })
    })
  })

  describe('saveFromYaml', () => {
    it('updates status on success', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      const status = { has_credential: true }
      vi.mocked(credentialsApi.putFromYaml).mockResolvedValueOnce({ data: status } as any)

      const store = useOpenStackCredentialsStore()
      const result = await store.saveFromYaml({ yaml: 'clouds: {}' } as any)

      expect(result).toEqual(status)
      expect(store.status).toEqual(status)
    })

    it('re-throws with a yaml-specific fallback message', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      vi.mocked(credentialsApi.putFromYaml).mockRejectedValueOnce({ isAxiosError: true, response: {} })

      const store = useOpenStackCredentialsStore()
      await expect(store.saveFromYaml({} as any)).rejects.toBeTruthy()
      expect(store.error).toBe('Failed to parse clouds.yaml')
    })

    it('refreshes status via fetch() when the upload fails due to a lock', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      vi.mocked(credentialsApi.putFromYaml).mockRejectedValueOnce(lockedError(2))
      vi.mocked(credentialsApi.get).mockResolvedValueOnce({ data: { is_locked: true } } as any)

      const store = useOpenStackCredentialsStore()
      await expect(store.saveFromYaml({} as any)).rejects.toBeTruthy()

      expect(credentialsApi.get).toHaveBeenCalledTimes(1)
    })
  })

  describe('remove', () => {
    it('clears the credential and refreshes status', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      vi.mocked(credentialsApi.remove).mockResolvedValueOnce({} as any)
      vi.mocked(credentialsApi.get).mockResolvedValueOnce({ data: { has_credential: false } } as any)

      const store = useOpenStackCredentialsStore()
      await store.remove()

      expect(credentialsApi.remove).toHaveBeenCalled()
      expect(store.status).toEqual({ has_credential: false })
    })

    it('re-throws on failure and records the error', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      vi.mocked(credentialsApi.remove).mockRejectedValueOnce(new Error('cannot delete'))

      const store = useOpenStackCredentialsStore()
      await expect(store.remove()).rejects.toThrow('cannot delete')
      expect(store.error).toBe('cannot delete')
    })

    it('refreshes status via fetch() when removal fails due to a lock', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      vi.mocked(credentialsApi.remove).mockRejectedValueOnce(lockedError(4))
      vi.mocked(credentialsApi.get).mockResolvedValueOnce({ data: { is_locked: true, active_deployments: 4 } } as any)

      const store = useOpenStackCredentialsStore()
      await expect(store.remove()).rejects.toBeTruthy()

      expect(credentialsApi.get).toHaveBeenCalledTimes(1)
      expect(store.activeDeployments).toBe(4)
    })
  })

  describe('test', () => {
    it('updates status on successful validation', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      const status = { has_credential: true, last_validation_error: null }
      vi.mocked(credentialsApi.test).mockResolvedValueOnce({ data: status } as any)

      const store = useOpenStackCredentialsStore()
      const result = await store.test()

      expect(result).toEqual(status)
      expect(store.status).toEqual(status)
    })

    it('re-throws on failure without auto-refreshing on a lock (test never locks)', async () => {
      const { credentialsApi } = await import('@/api/credentials.api')
      vi.mocked(credentialsApi.test).mockRejectedValueOnce(new Error('invalid credentials'))

      const store = useOpenStackCredentialsStore()
      await expect(store.test()).rejects.toThrow('invalid credentials')
      expect(store.error).toBe('invalid credentials')
      expect(credentialsApi.get).not.toHaveBeenCalled()
    })
  })

  describe('reset', () => {
    it('clears status, error and loading', () => {
      const store = useOpenStackCredentialsStore()
      store.status = { has_credential: true } as any
      store.error = 'some error'
      store.loading = true

      store.reset()

      expect(store.status).toBeNull()
      expect(store.error).toBeNull()
      expect(store.loading).toBe(false)
    })
  })
})
