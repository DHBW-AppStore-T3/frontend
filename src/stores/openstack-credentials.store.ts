import { defineStore } from 'pinia'
import axios from 'axios'
import { credentialsApi } from '@/api/credentials.api'
import { extractErrorMessage } from '@/utils/http-error'
import type {
  OpenStackCredential,
  OpenStackCredentialFromYaml,
  OpenStackCredentialUpsert,
} from '@/types/openstack-credential'

interface State {
  // null until the first ``GET /me/openstack-credentials`` resolved.
  credentials: OpenStackCredential[] | null
  loading: boolean
  error: string | null
}

const LOCKED_REASON = 'openstack_credentials_locked'
const INVALID_REASON = 'openstack_credentials_invalid'

/**
 * The messages this store renders specially on top of the shared extractor:
 * a 409 ``openstack_credentials_locked`` carries the number of deployments
 * still holding the credential, a 422 ``openstack_credentials_invalid`` the
 * reason Keystone gave (``cause``). Everything else delegates to
 * ``extractErrorMessage``.
 */
function extractError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail
    if (detail && typeof detail === 'object') {
      const reason = (detail as { reason?: string }).reason
      if (reason === LOCKED_REASON) {
        const n = (detail as { active_deployments?: number }).active_deployments ?? 0
        return `Credential gesperrt — ${n} aktive(s) Deployment(s)`
      }
      if (reason === INVALID_REASON) {
        return `Keystone lehnt die Credential ab (${(detail as { cause?: string }).cause ?? 'error'})`
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

/** Usable for a deployment: Keystone named its project and the last check passed. */
export function isUsable(c: OpenStackCredential): boolean {
  return c.project_verified && !c.last_validation_error
}

// Dedupe concurrent fetch() calls — DashboardView mount, auth store
// post-login, and route guards can all kick this off at the same time
// on a cold load. Without this, each trigger hits the backend.
let fetchPromise: Promise<OpenStackCredential[] | null> | null = null

/**
 * The caller's OpenStack credentials, one per project. Only VM apps (the
 * Windows desktop) need one; pod apps run without.
 */
export const useOpenStackCredentialsStore = defineStore('openstack-credentials', {
  state: (): State => ({
    credentials: null,
    loading: false,
    error: null,
  }),

  getters: {
    list: (s): OpenStackCredential[] => s.credentials ?? [],
    hasAnyCredential: (s) => (s.credentials?.length ?? 0) > 0,
    // At least one credential a VM deployment can be created with.
    hasUsableCredential: (s) => (s.credentials ?? []).some(isUsable),
    usable: (s): OpenStackCredential[] => (s.credentials ?? []).filter(isUsable),
    // Credentials saved before projects were checked: their owner presses
    // "check" once, until then they cannot be used.
    unverified: (s): OpenStackCredential[] => (s.credentials ?? []).filter((c) => !c.project_verified),
    failing: (s): OpenStackCredential[] =>
      (s.credentials ?? []).filter((c) => c.project_verified && !!c.last_validation_error),
    // True once the GET has resolved at least once. Banners and disabled
    // states gate on this to avoid a "missing" message flashing during the
    // initial fetch.
    isResolved: (s) => s.credentials !== null,
    byId: (s) => (credentialId: string | null | undefined): OpenStackCredential | null => {
      if (!credentialId) return null
      return (s.credentials ?? []).find((c) => c.credentialId === credentialId) ?? null
    },
  },

  actions: {
    async fetch() {
      if (fetchPromise) return fetchPromise
      fetchPromise = (async () => {
        this.loading = true
        this.error = null
        try {
          const res = await credentialsApi.list()
          this.credentials = res.data
          return res.data
        } catch (err) {
          this.error = extractError(err, 'Failed to load OpenStack credentials')
          return null
        } finally {
          this.loading = false
          fetchPromise = null
        }
      })()
      return fetchPromise
    },

    /** Insert or replace (same project) a credential and return it. */
    upsertLocal(row: OpenStackCredential) {
      const rows = [...(this.credentials ?? [])]
      const index = rows.findIndex((c) => c.credentialId === row.credentialId)
      if (index >= 0) rows[index] = row
      else rows.push(row)
      this.credentials = rows
      return row
    },

    async save(payload: OpenStackCredentialUpsert) {
      this.loading = true
      this.error = null
      try {
        const res = await credentialsApi.save(payload)
        // A replaced credential keeps its id; re-read so nothing stale stays.
        await this.fetch()
        return res.data
      } catch (err) {
        this.error = extractError(err, 'Failed to save OpenStack credentials')
        throw err
      } finally {
        this.loading = false
      }
    },

    async saveFromYaml(body: OpenStackCredentialFromYaml) {
      this.loading = true
      this.error = null
      try {
        const res = await credentialsApi.saveFromYaml(body)
        await this.fetch()
        return res.data
      } catch (err) {
        this.error = extractError(err, 'Failed to parse clouds.yaml')
        throw err
      } finally {
        this.loading = false
      }
    },

    async remove(credentialId: string) {
      this.loading = true
      this.error = null
      try {
        await credentialsApi.remove(credentialId)
        this.credentials = (this.credentials ?? []).filter((c) => c.credentialId !== credentialId)
      } catch (err) {
        const message = extractError(err, 'Failed to delete OpenStack credentials')
        // A lock means live deployments need it: show their current count.
        if (isLockedError(err)) await this.fetch()
        this.error = message
        throw err
      } finally {
        this.loading = false
      }
    },

    /**
     * Ask Keystone again. Always resolves with the updated credential; a
     * failure is in its ``last_validation_error``. Verifying an old
     * credential can place deployments in its project, so the list is
     * re-read.
     */
    async test(credentialId: string) {
      this.loading = true
      this.error = null
      try {
        const res = await credentialsApi.test(credentialId)
        this.upsertLocal(res.data)
        return res.data
      } catch (err) {
        this.error = extractError(err, 'Failed to validate OpenStack credentials')
        throw err
      } finally {
        this.loading = false
      }
    },

    reset() {
      this.credentials = null
      this.error = null
      this.loading = false
    },
  },
})
