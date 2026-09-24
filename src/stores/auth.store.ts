import { defineStore } from 'pinia'
import { AuthService } from '@/services/auth.service'
import { useKeycloak } from '@/composables/useKeycloak'
import { useOpenStackCredentialsStore } from '@/stores/openstack-credentials.store'
import { invalidateAll as invalidateOpenStackCache } from '@/composables/useOpenStackResourceCache'
import type { User, UserRole } from '@/types'

const keycloak = useKeycloak()

// In-flight promises to dedupe concurrent calls. The router guard,
// App mount, and view mounts can all trigger initialize/fetchMe at the
// same time on a cold load — without this, each call hits the backend
// (token validation, /users/me, credential fetch) once per trigger.
let initializePromise: Promise<void> | null = null
let fetchMePromise: Promise<void> | null = null

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    isLoading: false,
    error: null as string | null,
  }),

  getters: {
    isAuthenticated: () => keycloak.isAuthenticated.value,
    
    userRole: (state): UserRole | null => state.user?.role || null,
    
    isStudent: (state) => state.user?.role === 'student',
    isTeacher: (state) => state.user?.role === 'teacher',
    isAdmin: (state) => state.user?.role === 'admin',
    
    isTeacherOrAdmin: (state) => 
      state.user?.role === 'teacher' || state.user?.role === 'admin',
    
    userId: (state) => state.user?.userId || null,
  },

  // These actions deliberately do NOT use `runRequest` from ./_request.
  // They wrap Keycloak/OIDC calls, not axios calls: the useful text is on
  // `err.message`, there is no `response.data.detail` to extract, and
  // `initialize`/`fetchMe` are promise-cached and log rather than setting
  // `error`. Routing them through the shared helper would replace real
  // Keycloak error messages with a generic fallback.
  actions: {
    async initialize() {
      if (initializePromise) return initializePromise
      initializePromise = (async () => {
        this.isLoading = true
        try {
          await keycloak.initialize()

          if (keycloak.isAuthenticated.value) {
            const storedUser = AuthService.getStoredUser()
            if (storedUser) {
              this.user = storedUser
            }

            this.fetchMe().catch(() => {})
          }
        } catch (error) {
          console.error('Auth initialization failed:', error)
        } finally {
          this.isLoading = false
        }
      })()
      return initializePromise
    },

    async login(returnUrl?: string) {
      this.error = null
      try {
        await keycloak.login(returnUrl)
      } catch (err: any) {
        this.error = err.message || 'Login failed'
        throw err
      }
    },

    async handleCallback() {
      /**
       * Finalize the Authorization Code + PKCE flow.
       * Resolves return URL from Keycloak, then loads the current user from backend.
       */
      this.isLoading = true
      this.error = null
      
      try {
        const returnUrl = await keycloak.handleCallback()
        
        await this.fetchMe()
        
        return returnUrl
      } catch (err: any) {
        this.error = err.message || 'Callback handling failed'
        throw err
      } finally {
        this.isLoading = false
      }
    },

    async fetchMe() {
      if (fetchMePromise) return fetchMePromise
      fetchMePromise = (async () => {
        try {
          this.user = await AuthService.fetchMe()
          useOpenStackCredentialsStore().fetch().catch(() => {})
        } catch (error) {
          console.error('Failed to fetch user:', error)
          this.user = null
          throw error
        } finally {
          fetchMePromise = null
        }
      })()
      return fetchMePromise
    },

    async logout() {
      AuthService.clearStoredUser()
      this.user = null
      this.error = null
      initializePromise = null
      fetchMePromise = null
      useOpenStackCredentialsStore().reset()
      // Clear the OpenStack resource display cache — the next user has their own
      // credentials and a different project, so old resource lists must not persist.
      invalidateOpenStackCache()

      try {
        await keycloak.logout()
      } catch (error) {
        console.error('Logout failed:', error)
      }
    },

    /**
     * Dev-only bridge: inject a pre-authenticated user via ?sso_handoff=email
     * without a running self-service-ui or Keycloak flow. Never the
     * production self-service-ui path — see setHandoffUser for that.
     */
    async setDevUser(email: string) {
      await keycloak.setDevUser(email)
      this.user = this.buildStubUser(email, 'student')
      this.fetchMe().catch(() => {
        this.user = this.buildStubUser(email, 'student')
      })
    },

    /**
     * Authenticate from a Moodle LTI 1.3 launch. Backend already validated
     * the launch and JIT-provisioned/promoted the user; a stub is shown
     * immediately so the UI isn't blank while fetchMe() loads the real
     * record. If fetchMe() fails, the stub stays — better than bouncing an
     * LTI-launched user back to an unauthenticated state.
     */
    async setLtiUser(email: string, token: string, role: UserRole = 'student') {
      await keycloak.setLtiUser(email, token)
      this.user = this.buildStubUser(email, role)
      this.fetchMe().catch(() => {
        this.user = this.buildStubUser(email, role)
      })
    },

    /**
     * Authenticate from a self-service-ui handoff. Backend already
     * validated self-service-ui's Keycloak bearer and minted a handoff
     * token; role is unknown until fetchMe() resolves, so the stub defaults
     * to 'student' and is replaced (or kept, on failure) same as LTI.
     */
    async setHandoffUser(email: string, token: string) {
      await keycloak.setHandoffUser(email, token)
      this.user = this.buildStubUser(email, 'student')
      this.fetchMe().catch(() => {
        this.user = this.buildStubUser(email, 'student')
      })
    },

    buildStubUser(email: string, role: UserRole): User {
      return {
        userId: email,
        email,
        username: email,
        role,
        courseId: null,
        created_at: new Date().toISOString(),
      }
    },

    hasRole(role: UserRole): boolean {
      return this.user?.role === role
    },

    hasAnyRole(...roles: UserRole[]): boolean {
      if (!this.user?.role) return false
      return roles.includes(this.user.role as UserRole)
    },
  },
})
