import { defineStore } from 'pinia'
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
}

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

export const useOpenStackCredentialsStore = defineStore('openstack-credentials', {
  state: (): State => ({
    status: null,
    loading: false,
    error: null,
  }),

  getters: {
    hasCredential: (s) => !!s.status?.has_credential,
    isValidated: (s) =>
      !!s.status?.last_validated_at && !s.status?.last_validation_error,
    lastError: (s) => s.status?.last_validation_error || null,
    isLocked: (s) => !!s.status?.is_locked,
    activeDeployments: (s) => s.status?.active_deployments ?? 0,
    // True once the GET /me/openstack-credentials has resolved at least
    // once. Banners and disabled states should gate on this to avoid the
    // "fehlen" message flashing during the initial fetch.
    isResolved: (s) => s.status !== null,
  },

  actions: {
    async fetch() {
      if (fetchPromise) return fetchPromise
      fetchPromise = (async () => {
        this.loading = true
        this.error = null
        try {
          const res = await credentialsApi.get()
          this.status = res.data
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

    async save(payload: OpenStackCredentialUpsert) {
      this.loading = true
      this.error = null
      try {
        const res = await credentialsApi.put(payload)
        this.status = res.data
        return res.data
      } catch (err) {
        this.error = extractError(err, 'Failed to save OpenStack credentials')
        if (isLockedError(err)) await this.fetch()
        throw err
      } finally {
        this.loading = false
      }
    },

    async saveFromYaml(body: OpenStackCredentialFromYaml) {
      this.loading = true
      this.error = null
      try {
        const res = await credentialsApi.putFromYaml(body)
        this.status = res.data
        return res.data
      } catch (err) {
        this.error = extractError(err, 'Failed to parse clouds.yaml')
        if (isLockedError(err)) await this.fetch()
        throw err
      } finally {
        this.loading = false
      }
    },

    async remove() {
      this.loading = true
      this.error = null
      try {
        await credentialsApi.remove()
        await this.fetch()
      } catch (err) {
        this.error = extractError(err, 'Failed to delete OpenStack credentials')
        if (isLockedError(err)) await this.fetch()
        throw err
      } finally {
        this.loading = false
      }
    },

    async test() {
      this.loading = true
      this.error = null
      try {
        const res = await credentialsApi.test()
        this.status = res.data
        return res.data
      } catch (err) {
        this.error = extractError(err, 'Failed to validate OpenStack credentials')
        throw err
      } finally {
        this.loading = false
      }
    },

    reset() {
      this.status = null
      this.error = null
      this.loading = false
    },
  },
})
