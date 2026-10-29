import { UserManager, WebStorageStateStore, InMemoryWebStorage, User } from 'oidc-client-ts'
import { createStore } from 'zustand/vanilla'
import { safeReturnUrl } from '@/utils/return-url'
import { env } from '@/env'

// ----------------------------------------------------------------
// KEYCLOAK CONFIGURATION
// ----------------------------------------------------------------
const KEYCLOAK_URL = env.KEYCLOAK_URL
const KEYCLOAK_REALM = env.KEYCLOAK_REALM
const CLIENT_ID = env.KEYCLOAK_CLIENT_ID
const APP_URL = env.APP_URL

// ----------------------------------------------------------------
// USER MANAGER SETUP
// ----------------------------------------------------------------
// Tokens live in memory only — never in localStorage. Any XSS payload that
// runs in the page would otherwise be able to exfiltrate a long-lived access
// token. The trade-off is that a hard reload drops the in-tab session; we
// rely on Keycloak's SSO cookie + signinSilent to re-issue tokens on demand.
const userManager = new UserManager({
  authority: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`,
  client_id: CLIENT_ID,
  redirect_uri: `${APP_URL}/callback`,
  post_logout_redirect_uri: `${APP_URL}/login`,
  response_type: 'code',
  scope: 'openid profile email',

  userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),

  // Automatic silent renew
  automaticSilentRenew: true,
  silent_redirect_uri: `${APP_URL}/silent-refresh.html`,

  // Token settings
  loadUserInfo: true,

  // Metadata settings (optional, will be fetched automatically)
  metadataUrl: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration`,
})

// ----------------------------------------------------------------
// OBSERVABLE STATE
// ----------------------------------------------------------------
// A vanilla (non-React) store: the axios interceptor and router guards read
// it outside of components, the auth store mirrors it via `subscribe`.
interface KeycloakState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  devEmail: string | null
  ltiToken: string | null
}

const state = createStore<KeycloakState>()(() => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  devEmail: null,
  ltiToken: null,
}))

// ----------------------------------------------------------------
// REFRESH SINGLE-FLIGHT
// ----------------------------------------------------------------
// Multiple parallel requests routinely hit the 401-then-refresh path at the
// same time (page load fires 5+ XHRs). Without coalescing, each one calls
// signinSilent() independently, which spawns 5+ hidden iframes and races —
// some succeed, some fail with `login_required`, and the user is bounced
// back to the login page even though Keycloak's SSO cookie is fine.
//
// Module-scoped because the UserManager is module-scoped: every consumer of
// `useKeycloak()` shares the same in-flight refresh.
let refreshInFlight: Promise<User | null> | null = null

async function refreshTokenSingleFlight(): Promise<User | null> {
  if (refreshInFlight) {
    return refreshInFlight
  }
  refreshInFlight = (async () => {
    try {
      const refreshed = await userManager.signinSilent()
      state.setState({ user: refreshed, isAuthenticated: !!refreshed })
      return refreshed
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

// An authorization code can be redeemed exactly once, and Keycloak revokes the
// whole session when it is presented a second time. React StrictMode (dev)
// runs the callback view's effect twice, so concurrent callers must share
// one code exchange.
let callbackInFlight: Promise<string> | null = null

// ----------------------------------------------------------------
// SERVICE
// ----------------------------------------------------------------
// Not a React hook on purpose: it is used from non-component code (axios
// interceptors, route guards, stores). React code observes it through the
// auth store.
function createKeycloak() {
  /**
   * Initialize authentication - load user from storage, falling back to a
   * silent SSO refresh against Keycloak when the in-memory store is empty
   * (e.g. after a hard reload). Without this fallback, every full page reload
   * forces an interactive login redirect even though Keycloak's session
   * cookie is still valid.
   */
  async function initialize() {
    state.setState({ isLoading: true })
    try {
      const storedUser = await userManager.getUser()
      if (storedUser && !storedUser.expired) {
        state.setState({ user: storedUser, isAuthenticated: true })
        return
      }

      try {
        const refreshed = await refreshTokenSingleFlight()
        if (refreshed && !refreshed.expired) {
          state.setState({ user: refreshed, isAuthenticated: true })
          return
        }
      } catch {
        // No SSO session available — fall through to unauthenticated state.
      }

      state.setState({ user: null, isAuthenticated: false })
    } catch (error) {
      console.error('Failed to initialize auth:', error)
      state.setState({ user: null, isAuthenticated: false })
    } finally {
      state.setState({ isLoading: false })
    }
  }

  /**
   * Redirect to Keycloak login
   */
  async function login(returnUrl?: string) {
    try {
      // Store return URL for after login
      if (returnUrl) {
        sessionStorage.setItem('returnUrl', safeReturnUrl(returnUrl))
      }
      await userManager.signinRedirect()
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }

  /**
   * Handle callback from Keycloak after login
   */
  function handleCallback(): Promise<string> {
    if (callbackInFlight) return callbackInFlight
    callbackInFlight = (async () => {
      try {
        const callbackUser = await userManager.signinRedirectCallback()
        state.setState({ user: callbackUser, isAuthenticated: true })

        // Get return URL and clean up
        const returnUrl = safeReturnUrl(sessionStorage.getItem('returnUrl'))
        sessionStorage.removeItem('returnUrl')

        return returnUrl
      } catch (error) {
        console.error('Callback handling failed:', error)
        throw error
      } finally {
        callbackInFlight = null
      }
    })()
    return callbackInFlight
  }

  /**
   * Logout and redirect to Keycloak
   */
  async function logout() {
    try {
      await userManager.signoutRedirect()
      state.setState({ user: null, isAuthenticated: false })
    } catch (error) {
      console.error('Logout failed:', error)
      throw error
    }
  }

  /**
   * Get current access token, refreshing it once via the shared single-flight
   * promise if it has expired. Returns null if no session is present or the
   * refresh fails.
   */
  async function getAccessToken(): Promise<string | null> {
    const { ltiToken, devEmail } = state.getState()
    if (ltiToken) return ltiToken
    if (devEmail) return 'dev-sso-token'
    try {
      const currentUser = await userManager.getUser()
      if (!currentUser) return null
      if (!currentUser.expired) return currentUser.access_token || null

      const refreshed = await refreshTokenSingleFlight()
      return refreshed?.access_token || null
    } catch (error) {
      console.error('Failed to get access token:', error)
      return null
    }
  }

  /**
   * Get user info
   */
  async function getUser(): Promise<User | null> {
    try {
      return await userManager.getUser()
    } catch (error) {
      console.error('Failed to get user:', error)
      return null
    }
  }

  /**
   * Check if token is expired and refresh if needed.
   * All concurrent callers share a single signinSilent() round-trip.
   */
  async function ensureValidToken(): Promise<boolean> {
    const { ltiToken, devEmail } = state.getState()
    if (ltiToken || devEmail) return true
    try {
      const currentUser = await userManager.getUser()
      if (!currentUser) return false
      if (!currentUser.expired) return true

      const refreshed = await refreshTokenSingleFlight()
      return !!refreshed && !refreshed.expired
    } catch (error) {
      console.error('Token refresh failed:', error)
      return false
    }
  }

  /**
   * Dev-mode only: inject a pre-authenticated user without a Keycloak redirect.
   */
  async function setDevUser(email: string): Promise<void> {
    state.setState({ devEmail: email, isAuthenticated: true, isLoading: false })
  }

  /**
   * Set the authenticated user from a Moodle LTI 1.3 launch. Backend has
   * already validated the launch and issued a short-lived HS256 session
   * token — no Keycloak flow needed for this path.
   */
  async function setLtiUser(email: string, token: string): Promise<void> {
    state.setState({ ltiToken: token, devEmail: email, isAuthenticated: true, isLoading: false })
  }

  function getDevEmail(): string | null {
    return state.getState().devEmail
  }

  return {
    // State
    getState: state.getState,
    subscribe: state.subscribe,

    // Methods
    initialize,
    login,
    handleCallback,
    logout,
    getAccessToken,
    getUser,
    ensureValidToken,
    setDevUser,
    getDevEmail,
    setLtiUser,
  }
}

export const keycloak = createKeycloak()
