import { create } from 'zustand'
import { AuthService } from '@/services/auth.service'
import { keycloak } from '@/services/keycloak.service'
import type { User, UserRole } from '@/types'

// In-flight promises to dedupe concurrent calls. The router guard,
// App mount, and view mounts can all trigger initialize/fetchMe at the
// same time on a cold load — without this, each call hits the backend
// (token validation, /users/me, credential fetch) once per trigger.
let initializePromise: Promise<void> | null = null
let fetchMePromise: Promise<void> | null = null

interface AuthState {
  user: User | null
  isLoading: boolean
  error: string | null
  // Mirrors `keycloak.getState().isAuthenticated`; kept in the store so React
  // components re-render on login/logout and non-React code (router guards)
  // can read it.
  isAuthenticated: boolean

  initialize: () => Promise<void>
  login: (returnUrl?: string) => Promise<void>
  handleCallback: () => Promise<string>
  fetchMe: () => Promise<void>
  logout: () => Promise<void>
  setDevUser: (email: string) => Promise<void>
  setLtiUser: (email: string, token: string, role?: UserRole) => Promise<void>
  buildStubUser: (email: string, role: UserRole) => User
  hasRole: (role: UserRole) => boolean
  hasAnyRole: (...roles: UserRole[]) => boolean
}

type AuthData = Pick<AuthState, 'user'>

// Derived values as selectors: `useAuthStore(selectIsAdmin)`.
export const selectUserRole = (s: AuthData): UserRole | null => s.user?.role || null
export const selectIsStudent = (s: AuthData) => s.user?.role === 'student'
export const selectIsTeacher = (s: AuthData) => s.user?.role === 'teacher'
export const selectIsAdmin = (s: AuthData) => s.user?.role === 'admin'
export const selectIsTeacherOrAdmin = (s: AuthData) =>
  s.user?.role === 'teacher' || s.user?.role === 'admin'
export const selectUserId = (s: AuthData) => s.user?.userId || null

export const useAuthStore = create<AuthState>()((set, get) => {
  // Keep the mirrored flag in sync with Keycloak (login, silent refresh,
  // logout, LTI/dev injection).
  const syncAuthenticated = () => set({ isAuthenticated: keycloak.getState().isAuthenticated })
  keycloak.subscribe(syncAuthenticated)

  return {
    user: null,
    isLoading: false,
    error: null,
    isAuthenticated: keycloak.getState().isAuthenticated,

    // These actions deliberately do NOT use `runRequest` from ./_request.
    // They wrap Keycloak/OIDC calls, not axios calls: the useful text is on
    // `err.message`, there is no `response.data.detail` to extract, and
    // `initialize`/`fetchMe` are promise-cached and log rather than setting
    // `error`. Routing them through the shared helper would replace real
    // Keycloak error messages with a generic fallback.
    async initialize() {
      if (initializePromise) return initializePromise
      initializePromise = (async () => {
        set({ isLoading: true })
        try {
          await keycloak.initialize()
          syncAuthenticated()

          if (keycloak.getState().isAuthenticated) {
            const storedUser = AuthService.getStoredUser()
            if (storedUser) {
              set({ user: storedUser })
            }

            get().fetchMe().catch(() => {})
          }
        } catch (error) {
          console.error('Auth initialization failed:', error)
        } finally {
          set({ isLoading: false })
        }
      })()
      return initializePromise
    },

    async login(returnUrl) {
      set({ error: null })
      try {
        await keycloak.login(returnUrl)
      } catch (err: any) {
        set({ error: err.message || 'Login failed' })
        throw err
      }
    },

    /**
     * Finalize the Authorization Code + PKCE flow.
     * Resolves return URL from Keycloak, then loads the current user from backend.
     */
    async handleCallback() {
      set({ isLoading: true, error: null })

      try {
        const returnUrl = await keycloak.handleCallback()
        syncAuthenticated()

        await get().fetchMe()

        return returnUrl
      } catch (err: any) {
        set({ error: err.message || 'Callback handling failed' })
        throw err
      } finally {
        set({ isLoading: false })
      }
    },

    async fetchMe() {
      if (fetchMePromise) return fetchMePromise
      fetchMePromise = (async () => {
        try {
          set({ user: await AuthService.fetchMe() })
        } catch (error) {
          console.error('Failed to fetch user:', error)
          set({ user: null })
          throw error
        } finally {
          fetchMePromise = null
        }
      })()
      return fetchMePromise
    },

    async logout() {
      AuthService.clearStoredUser()
      set({ user: null, error: null })
      initializePromise = null
      fetchMePromise = null

      try {
        await keycloak.logout()
      } catch (error) {
        console.error('Logout failed:', error)
      }
      syncAuthenticated()
    },

    /**
     * Dev-only bridge: inject a pre-authenticated user via ?sso_handoff=email
     * without a running Keycloak flow (`import.meta.env.DEV` builds only).
     */
    async setDevUser(email) {
      await keycloak.setDevUser(email)
      syncAuthenticated()
      const stub = () => set({ user: get().buildStubUser(email, 'student') })
      stub()
      get().fetchMe().catch(stub)
    },

    /**
     * Authenticate from a Moodle LTI 1.3 launch. Backend already validated
     * the launch and JIT-provisioned/promoted the user; a stub is shown
     * immediately so the UI isn't blank while fetchMe() loads the real
     * record. If fetchMe() fails, the stub stays — better than bouncing an
     * LTI-launched user back to an unauthenticated state.
     */
    async setLtiUser(email, token, role = 'student') {
      await keycloak.setLtiUser(email, token)
      syncAuthenticated()
      const stub = () => set({ user: get().buildStubUser(email, role) })
      stub()
      get().fetchMe().catch(stub)
    },

    buildStubUser(email, role) {
      return {
        userId: email,
        email,
        username: email,
        role,
        courseId: null,
        created_at: new Date().toISOString(),
      }
    },

    hasRole(role) {
      return get().user?.role === role
    },

    hasAnyRole(...roles) {
      const role = get().user?.role
      if (!role) return false
      return roles.includes(role as UserRole)
    },
  }
})
