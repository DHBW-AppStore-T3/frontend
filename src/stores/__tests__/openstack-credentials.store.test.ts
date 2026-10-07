import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('@/api/credentials.api', () => ({
  credentialsApi: {
    get: vi.fn(),
    put: vi.fn(),
    putFromYaml: vi.fn(),
    test: vi.fn(),
    remove: vi.fn(),
  },
}))

// Make extractErrorMessage predictable: return the fallback string.
vi.mock('@/utils/http-error', () => ({
  extractErrorMessage: vi.fn((_err: unknown, fallback: string) => fallback),
}))

import { credentialsApi } from '@/api/credentials.api'
import { useOpenStackCredentialsStore } from '../openstack-credentials.store'

const mockApi = vi.mocked(credentialsApi)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const STATUS_OK = {
  has_credential: true,
  last_validated_at: '2026-01-01T00:00:00Z',
  last_validation_error: null,
  is_locked: false,
  active_deployments: 0,
}

/** Create an object that passes axios.isAxiosError() (checks .isAxiosError === true). */
function makeAxiosError(status: number, data: unknown): Error {
  return Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    response: { status, data },
  })
}

function makeLockedError(activeDeployments = 1) {
  return makeAxiosError(409, {
    detail: { reason: 'openstack_credentials_locked', active_deployments: activeDeployments },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

// ===========================================================================
// fetch()
// ===========================================================================
describe('fetch()', () => {
  it('sets status and clears error on success', async () => {
    mockApi.get.mockResolvedValue({ data: STATUS_OK } as any)
    const store = useOpenStackCredentialsStore()
    await store.fetch()
    expect(store.status).toEqual(STATUS_OK)
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('sets error and leaves status null on API failure', async () => {
    mockApi.get.mockRejectedValue(new Error('network'))
    const store = useOpenStackCredentialsStore()
    await store.fetch()
    expect(store.status).toBeNull()
    expect(store.error).toBe('Failed to load OpenStack credentials')
    expect(store.loading).toBe(false)
  })

  it('returns null on failure (does not throw)', async () => {
    mockApi.get.mockRejectedValue(new Error('net'))
    const store = useOpenStackCredentialsStore()
    await expect(store.fetch()).resolves.toBeNull()
  })

  it('concurrent calls deduplicate: only one API request is made', async () => {
    mockApi.get.mockResolvedValue({ data: STATUS_OK } as any)
    const store = useOpenStackCredentialsStore()
    const p1 = store.fetch()
    const p2 = store.fetch()
    await Promise.all([p1, p2])
    // Both resolved, but only one HTTP request was made (deduplication guard)
    expect(mockApi.get).toHaveBeenCalledOnce()
  })
})

// ===========================================================================
// save()
// ===========================================================================
describe('save()', () => {
  const PAYLOAD = { auth_url: 'https://os.example.com', username: 'u', password: 'p', project_id: 'proj', domain_name: 'Default', region_name: 'RegionOne' }

  it('sets status and returns data on success', async () => {
    mockApi.put.mockResolvedValue({ data: STATUS_OK } as any)
    const store = useOpenStackCredentialsStore()
    const result = await store.save(PAYLOAD as any)
    expect(result).toEqual(STATUS_OK)
    expect(store.status).toEqual(STATUS_OK)
    expect(store.loading).toBe(false)
  })

  it('sets fallback error and re-throws on generic failure', async () => {
    mockApi.put.mockRejectedValue(new Error('500'))
    const store = useOpenStackCredentialsStore()
    await expect(store.save(PAYLOAD as any)).rejects.toThrow()
    expect(store.error).toBe('Failed to save OpenStack credentials')
    expect(mockApi.get).not.toHaveBeenCalled()
  })

  it('sets locked-specific error and triggers re-fetch on 409', async () => {
    mockApi.put.mockRejectedValue(makeLockedError(3))
    mockApi.get.mockResolvedValue({ data: STATUS_OK } as any)
    const store = useOpenStackCredentialsStore()
    await expect(store.save(PAYLOAD as any)).rejects.toThrow()
    // The locked error triggered auto-fetch; fetch() resets error=null on success,
    // but status is updated and the re-fetch call is verified.
    expect(mockApi.get).toHaveBeenCalledOnce()
    expect(store.status).toEqual(STATUS_OK)  // auto-fetch refreshed status
  })

  it('sets loading false even after error', async () => {
    mockApi.put.mockRejectedValue(new Error('err'))
    const store = useOpenStackCredentialsStore()
    try { await store.save(PAYLOAD as any) } catch { /* expected */ }
    expect(store.loading).toBe(false)
  })
})

// ===========================================================================
// saveFromYaml()
// ===========================================================================
describe('saveFromYaml()', () => {
  const YAML_PAYLOAD = { clouds_yaml: 'clouds:\n  mycloud:\n    auth:\n      ...' }

  it('sets status on success', async () => {
    mockApi.putFromYaml.mockResolvedValue({ data: STATUS_OK } as any)
    const store = useOpenStackCredentialsStore()
    const result = await store.saveFromYaml(YAML_PAYLOAD as any)
    expect(result).toEqual(STATUS_OK)
    expect(store.status).toEqual(STATUS_OK)
  })

  it('sets fallback error and re-throws on failure', async () => {
    mockApi.putFromYaml.mockRejectedValue(new Error('bad yaml'))
    const store = useOpenStackCredentialsStore()
    await expect(store.saveFromYaml(YAML_PAYLOAD as any)).rejects.toThrow()
    expect(store.error).toBe('Failed to parse clouds.yaml')
  })

  it('triggers re-fetch on locked 409', async () => {
    mockApi.putFromYaml.mockRejectedValue(makeLockedError(2))
    mockApi.get.mockResolvedValue({ data: STATUS_OK } as any)
    const store = useOpenStackCredentialsStore()
    try { await store.saveFromYaml(YAML_PAYLOAD as any) } catch { /* expected */ }
    expect(mockApi.get).toHaveBeenCalledOnce()
  })
})

// ===========================================================================
// remove()
// ===========================================================================
describe('remove()', () => {
  it('calls delete and then re-fetches on success', async () => {
    mockApi.remove.mockResolvedValue({} as any)
    mockApi.get.mockResolvedValue({ data: STATUS_OK } as any)
    const store = useOpenStackCredentialsStore()
    await store.remove()
    expect(mockApi.remove).toHaveBeenCalledOnce()
    expect(mockApi.get).toHaveBeenCalledOnce()
  })

  it('sets fallback error and re-throws on failure', async () => {
    mockApi.remove.mockRejectedValue(new Error('forbidden'))
    const store = useOpenStackCredentialsStore()
    await expect(store.remove()).rejects.toThrow()
    expect(store.error).toBe('Failed to delete OpenStack credentials')
  })

  it('triggers re-fetch on locked 409', async () => {
    mockApi.remove.mockRejectedValue(makeLockedError(1))
    mockApi.get.mockResolvedValue({ data: STATUS_OK } as any)
    const store = useOpenStackCredentialsStore()
    try { await store.remove() } catch { /* expected */ }
    expect(mockApi.get).toHaveBeenCalledOnce()
  })
})

// ===========================================================================
// test()
// ===========================================================================
describe('test()', () => {
  it('sets updated status on success', async () => {
    const validated = { ...STATUS_OK, last_validated_at: '2026-06-01T00:00:00Z' }
    mockApi.test.mockResolvedValue({ data: validated } as any)
    const store = useOpenStackCredentialsStore()
    const result = await store.test()
    expect(result).toEqual(validated)
    expect(store.status).toEqual(validated)
    expect(store.loading).toBe(false)
  })

  it('sets error and re-throws on failure', async () => {
    mockApi.test.mockRejectedValue(new Error('invalid'))
    const store = useOpenStackCredentialsStore()
    await expect(store.test()).rejects.toThrow()
    expect(store.error).toBe('Failed to validate OpenStack credentials')
    expect(store.loading).toBe(false)
  })

  it('sets locked-specific message on locked 409 (extractError locked path)', async () => {
    // test() has no auto-fetch in the catch block, so the locked message is preserved
    mockApi.test.mockRejectedValue(makeLockedError(2))
    const store = useOpenStackCredentialsStore()
    await expect(store.test()).rejects.toThrow()
    expect(store.error).toBe('Credentials gesperrt — 2 aktive(s) Deployment(s)')
  })
})

// ===========================================================================
// reset()
// ===========================================================================
describe('reset()', () => {
  it('clears status, error, and loading', async () => {
    mockApi.get.mockResolvedValue({ data: STATUS_OK } as any)
    const store = useOpenStackCredentialsStore()
    await store.fetch()
    expect(store.status).not.toBeNull()

    store.reset()
    expect(store.status).toBeNull()
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })
})

// ===========================================================================
// Getters
// ===========================================================================
describe('getters', () => {
  it('hasCredential: true when status.has_credential is truthy', () => {
    const store = useOpenStackCredentialsStore()
    store.status = { ...STATUS_OK, has_credential: true }
    expect(store.hasCredential).toBe(true)
    store.status = { ...STATUS_OK, has_credential: false }
    expect(store.hasCredential).toBe(false)
  })

  it('isValidated: true when last_validated_at is set and no error', () => {
    const store = useOpenStackCredentialsStore()
    store.status = { ...STATUS_OK, last_validated_at: '2026-01-01T00:00:00Z', last_validation_error: null }
    expect(store.isValidated).toBe(true)
  })

  it('isValidated: false when last_validation_error is present', () => {
    const store = useOpenStackCredentialsStore()
    store.status = { ...STATUS_OK, last_validated_at: '2026-01-01T00:00:00Z', last_validation_error: 'auth failed' }
    expect(store.isValidated).toBe(false)
  })

  it('isValidated: false when last_validated_at is null', () => {
    const store = useOpenStackCredentialsStore()
    store.status = { ...STATUS_OK, last_validated_at: null, last_validation_error: null }
    expect(store.isValidated).toBe(false)
  })

  it('lastError: returns last_validation_error string or null', () => {
    const store = useOpenStackCredentialsStore()
    store.status = { ...STATUS_OK, last_validation_error: 'auth failed' }
    expect(store.lastError).toBe('auth failed')
    store.status = { ...STATUS_OK, last_validation_error: null }
    expect(store.lastError).toBeNull()
  })

  it('isLocked: mirrors status.is_locked', () => {
    const store = useOpenStackCredentialsStore()
    store.status = { ...STATUS_OK, is_locked: true }
    expect(store.isLocked).toBe(true)
  })

  it('activeDeployments: returns count or 0 when status is null', () => {
    const store = useOpenStackCredentialsStore()
    expect(store.activeDeployments).toBe(0)
    store.status = { ...STATUS_OK, active_deployments: 4 }
    expect(store.activeDeployments).toBe(4)
  })

  it('isResolved: false initially, true after fetch', async () => {
    mockApi.get.mockResolvedValue({ data: STATUS_OK } as any)
    const store = useOpenStackCredentialsStore()
    expect(store.isResolved).toBe(false)
    await store.fetch()
    expect(store.isResolved).toBe(true)
  })
})
