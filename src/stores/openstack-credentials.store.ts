import { create } from 'zustand'
import axios from 'axios'
import { credentialsApi } from '@/api/credentials.api'
import { extractErrorMessage } from '@/utils/http-error'
import type {
  OpenStackCredential,
  OpenStackCredentialFromYaml,
  OpenStackCredentialUpsert,
} from '@/types/openstack-credential'

/**
 * The caller's OpenStack credentials, one per project. Only VM apps (the
 * Windows desktop) need one; pod apps run without.
 */
interface State {
  // null until the first `GET /me/openstack-credentials` resolved.
  credentials: OpenStackCredential[] | null
  loading: boolean
  error: string | null

  fetch: () => Promise<OpenStackCredential[] | null>
  save: (payload: OpenStackCredentialUpsert) => Promise<OpenStackCredential>
  saveFromYaml: (body: OpenStackCredentialFromYaml) => Promise<OpenStackCredential>
  remove: (credentialId: string) => Promise<void>
  test: (credentialId: string) => Promise<OpenStackCredential>
  reset: () => void
}

type Data = Pick<State, 'credentials'>

const LOCKED_REASON = 'openstack_credentials_locked'
const INVALID_REASON = 'openstack_credentials_invalid'

/** Usable for a deployment: Keystone named its project and the last check passed. */
export function isUsable(c: OpenStackCredential): boolean {
  return c.project_verified && !c.last_validation_error
}

// Derived values. Pure functions of the state slice, so tests and
// `getState()` callers can use them directly. Selectors that build a new
// array must be wrapped in `useShallow` when passed to the store hook.
export const selectCredentials = (s: Data): OpenStackCredential[] => s.credentials ?? []
export const selectHasAnyCredential = (s: Data) => (s.credentials?.length ?? 0) > 0
export const selectUsableCredentials = (s: Data) => selectCredentials(s).filter(isUsable)
// At least one credential a VM deployment can be created with.
export const selectHasUsableCredential = (s: Data) => selectCredentials(s).some(isUsable)
// Credentials saved before projects were checked: their owner presses
// "check" once, until then they cannot be used.
export const selectUnverifiedCredentials = (s: Data) =>
  selectCredentials(s).filter((c) => !c.project_verified)
export const selectFailingCredentials = (s: Data) =>
  selectCredentials(s).filter((c) => c.project_verified && !!c.last_validation_error)
// True once the GET has resolved at least once. Banners and disabled states
// gate on this to avoid a "missing" message flashing during the initial fetch.
export const selectIsResolved = (s: Data) => s.credentials !== null
export const selectCredentialById =
  (credentialId: string | null | undefined) =>
  (s: Data): OpenStackCredential | null =>
    credentialId ? (selectCredentials(s).find((c) => c.credentialId === credentialId) ?? null) : null

function errorDetail(err: unknown): Record<string, unknown> | null {
  if (!axios.isAxiosError(err)) return null
  const detail = err.response?.data?.detail
  return detail && typeof detail === 'object' ? (detail as Record<string, unknown>) : null
}

/**
 * The messages this store renders specially on top of the shared extractor:
 * a 409 `openstack_credentials_locked` carries the number of deployments
 * still holding the credential, a 422 `openstack_credentials_invalid` the
 * reason Keystone gave (`cause`). Everything else delegates to
 * `extractErrorMessage`.
 */
function extractError(err: unknown, fallback: string): string {
  const detail = errorDetail(err)
  if (detail?.reason === LOCKED_REASON) {
    return `Credential gesperrt — ${Number(detail.active_deployments ?? 0)} aktive(s) Deployment(s)`
  }
  if (detail?.reason === INVALID_REASON) {
    return `Keystone lehnt die Credential ab (${String(detail.cause ?? 'error')})`
  }
  return extractErrorMessage(err, fallback)
}

function isLockedError(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 409 && errorDetail(err)?.reason === LOCKED_REASON
}

// Dedupe concurrent fetch() calls — DashboardView mount, auth store
// post-login, and route guards can all kick this off at the same time
// on a cold load. Without this, each trigger hits the backend.
let fetchPromise: Promise<OpenStackCredential[] | null> | null = null

export const useOpenStackCredentialsStore = create<State>()((set, get) => {
  /** Run a request with the shared loading/error bookkeeping; errors are re-thrown. */
  async function tracked<T>(request: () => Promise<T>, fallback: string): Promise<T> {
    set({ loading: true, error: null })
    try {
      return await request()
    } catch (err) {
      set({ error: extractError(err, fallback) })
      throw err
    } finally {
      set({ loading: false })
    }
  }

  return {
    credentials: null,
    loading: false,
    error: null,

    async fetch() {
      if (fetchPromise) return fetchPromise
      fetchPromise = (async () => {
        set({ loading: true, error: null })
        try {
          const res = await credentialsApi.list()
          set({ credentials: res.data })
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

    save: (payload) =>
      tracked(async () => {
        const res = await credentialsApi.save(payload)
        // A replaced credential keeps its id; re-read so nothing stale stays.
        await get().fetch()
        return res.data
      }, 'Failed to save OpenStack credentials'),

    saveFromYaml: (body) =>
      tracked(async () => {
        const res = await credentialsApi.saveFromYaml(body)
        await get().fetch()
        return res.data
      }, 'Failed to parse clouds.yaml'),

    async remove(credentialId) {
      try {
        await tracked(async () => {
          await credentialsApi.remove(credentialId)
          set((s) => ({ credentials: selectCredentials(s).filter((c) => c.credentialId !== credentialId) }))
        }, 'Failed to delete OpenStack credentials')
      } catch (err) {
        // A lock means live deployments need it: show their current count.
        // The re-read clears the error, so the message is put back after it.
        if (isLockedError(err)) {
          const message = get().error
          await get().fetch()
          set({ error: message })
        }
        throw err
      }
    },

    /**
     * Ask Keystone again. Always resolves with the updated credential; a
     * failure is in its `last_validation_error`. Verifying an old credential
     * turns it into a usable one, so the row is replaced in place.
     */
    test: (credentialId) =>
      tracked(async () => {
        const res = await credentialsApi.test(credentialId)
        set((s) => ({ credentials: replaceOrAppend(selectCredentials(s), res.data) }))
        return res.data
      }, 'Failed to validate OpenStack credentials'),

    reset() {
      set({ credentials: null, error: null, loading: false })
    },
  }
})

function replaceOrAppend(rows: OpenStackCredential[], row: OpenStackCredential): OpenStackCredential[] {
  return rows.some((c) => c.credentialId === row.credentialId)
    ? rows.map((c) => (c.credentialId === row.credentialId ? row : c))
    : [...rows, row]
}
