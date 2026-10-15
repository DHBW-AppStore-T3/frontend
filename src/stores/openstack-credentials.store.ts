import { create } from 'zustand'
import axios from 'axios'
import { credentialsApi } from '@/api/credentials.api'
import { extractErrorMessage } from '@/utils/http-error'
import type {
  OpenStackCredentialFromYaml,
  OpenStackCredentialResponse,
  OpenStackCredentialUpsert,
} from '@/types/openstack-credential'

interface State {
  status: OpenStackCredentialResponse | null
  loading: boolean
  error: string | null

  fetch: () => Promise<OpenStackCredentialResponse | null>
  save: (payload: OpenStackCredentialUpsert) => Promise<OpenStackCredentialResponse>
  saveFromYaml: (body: OpenStackCredentialFromYaml) => Promise<OpenStackCredentialResponse>
  remove: () => Promise<void>
  test: () => Promise<OpenStackCredentialResponse>
  reset: () => void
}

type Data = Pick<State, 'status' | 'loading' | 'error'>

// Derived values. Pure functions of the state slice, so components can pass
// them straight to the store hook: `useOpenStackCredentialsStore(selectHasCredential)`.
export const selectHasCredential = (s: Data) => !!s.status?.has_credential
export const selectIsValidated = (s: Data) =>
  !!s.status?.last_validated_at && !s.status?.last_validation_error
export const selectLastError = (s: Data) => s.status?.last_validation_error || null
export const selectIsLocked = (s: Data) => !!s.status?.is_locked
export const selectActiveDeployments = (s: Data) => s.status?.active_deployments ?? 0
// True once the GET /me/openstack-credentials has resolved at least
// once. Banners and disabled states should gate on this to avoid the
// "fehlen" message flashing during the initial fetch.
export const selectIsResolved = (s: Data) => s.status !== null

const LOCKED_REASON = 'openstack_credentials_locked'

/**
 * Adds the one message this store renders specially on top of the shared
 * extractor: a 409 `openstack_credentials_locked` carries the number of
 * deployments still holding the credentials, which is the whole point of
 * the message. Everything else delegates to `extractErrorMessage`, which
 * used to be duplicated here.
 */
function extractError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail
    if (detail && typeof detail === 'object') {
      const reason = (detail as { reason?: string }).reason
      if (reason === LOCKED_REASON) {
        const n = (detail as { active_deployments?: number }).active_deployments ?? 0
        return `Credentials gesperrt — ${n} aktive(s) Deployment(s)`
      }
    }
  }
  return extractErrorMessage(err, fallback)
}

function isLockedError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false
  if (err.response?.status !== 409) return false
  const detail = err.response.data?.detail
  return !!(detail && typeof detail === 'object' && (detail as { reason?: string }).reason === LOCKED_REASON)
}

// Dedupe concurrent fetch() calls — DashboardView mount, auth store
// post-login, and route guards can all kick this off at the same time
// on a cold load. Without this, each trigger hits the backend.
let fetchPromise: Promise<OpenStackCredentialResponse | null> | null = null

export const useOpenStackCredentialsStore = create<State>()((set, get) => ({
  status: null,
  loading: false,
  error: null,

  async fetch() {
    if (fetchPromise) return fetchPromise
    fetchPromise = (async () => {
      set({ loading: true, error: null })
      try {
        const res = await credentialsApi.get()
        set({ status: res.data })
        return res.data
      } catch (err) {
        set({ error: extractError(err, 'Failed to load OpenStack credentials') })
        return null
      } finally {
        set({ loading: false })
        fetchPromise = null
      }
    })()
    return fetchPromise
  },

  async save(payload) {
    set({ loading: true, error: null })
    try {
      const res = await credentialsApi.put(payload)
      set({ status: res.data })
      return res.data
    } catch (err) {
      set({ error: extractError(err, 'Failed to save OpenStack credentials') })
      if (isLockedError(err)) await get().fetch()
      throw err
    } finally {
      set({ loading: false })
    }
  },

  async saveFromYaml(body) {
    set({ loading: true, error: null })
    try {
      const res = await credentialsApi.putFromYaml(body)
      set({ status: res.data })
      return res.data
    } catch (err) {
      set({ error: extractError(err, 'Failed to parse clouds.yaml') })
      if (isLockedError(err)) await get().fetch()
      throw err
    } finally {
      set({ loading: false })
    }
  },

  async remove() {
    set({ loading: true, error: null })
    try {
      await credentialsApi.remove()
      await get().fetch()
    } catch (err) {
      set({ error: extractError(err, 'Failed to delete OpenStack credentials') })
      if (isLockedError(err)) await get().fetch()
      throw err
    } finally {
      set({ loading: false })
    }
  },

  async test() {
    set({ loading: true, error: null })
    try {
      const res = await credentialsApi.test()
      set({ status: res.data })
      return res.data
    } catch (err) {
      set({ error: extractError(err, 'Failed to validate OpenStack credentials') })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  reset() {
    set({ status: null, error: null, loading: false })
  },
}))
