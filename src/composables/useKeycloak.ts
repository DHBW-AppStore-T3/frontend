import { UserManager, WebStorageStateStore, InMemoryWebStorage, User } from 'oidc-client-ts'
import { ref, readonly } from 'vue'
import { env } from '../env'

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
// REACTIVE STATE
// ----------------------------------------------------------------
const user = ref<User | null>(null)
const isLoading = ref(true)
const isAuthenticated = ref(false)
const devEmail = ref<string | null>(null)
const ltiToken = ref<string | null>(null)

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
      user.value = refreshed
      isAuthenticated.value = !!refreshed
      return refreshed
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

// ----------------------------------------------------------------
// COMPOSABLE
// ----------------------------------------------------------------
export function useKeycloak() {
  /**
   * Initialize authentication - load user from storage, falling back to a
   * silent SSO refresh against Keycloak when the in-memory store is empty
   * (e.g. after a hard reload). Without this fallback, every full page reload
   * forces an interactive login redirect even though Keycloak's session
   * cookie is still valid.
   */
  async function initialize() {
    isLoading.value = true
    try {
      const storedUser = await userManager.getUser()
      if (storedUser && !storedUser.expired) {
        user.value = storedUser
        isAuthenticated.value = true
        return
      }

      try {
        const refreshed = await refreshTokenSingleFlight()
        if (refreshed && !refreshed.expired) {
          user.value = refreshed
          isAuthenticated.value = true
          return
        }
      } catch {
        // No SSO session available — fall through to unauthenticated state.
      }

      user.value = null
      isAuthenticated.value = false
    } catch (error) {
      console.error('Failed to initialize auth:', error)
      user.value = null
      isAuthenticated.value = false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Redirect to Keycloak login
   */
  async function login(returnUrl?: string) {
    try {
      // Store return URL for after login
      if (returnUrl) {
        sessionStorage.setItem('returnUrl', returnUrl)
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
  async function handleCallback() {
    try {
      const callbackUser = await userManager.signinRedirectCallback()
      user.value = callbackUser
      isAuthenticated.value = true

      // Get return URL and clean up
      const returnUrl = sessionStorage.getItem('returnUrl') || '/'
      sessionStorage.removeItem('returnUrl')

      return returnUrl
    } catch (error) {
      console.error('Callback handling failed:', error)
      throw error
    }
  }

  /**
   * Logout and redirect to Keycloak
   */
  async function logout() {
    try {
      await userManager.signoutRedirect()
      user.value = null
      isAuthenticated.value = false
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
    if (ltiToken.value) return ltiToken.value
    if (devEmail.value) return 'dev-sso-token'
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
    if (devEmail.value) return true
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
   * Called by the SSO bridge when self-service-ui hands over the user identity.
   */
  async function setDevUser(email: string): Promise<void> {
    devEmail.value = email
    isAuthenticated.value = true
    isLoading.value = false
  }

  async function setLtiUser(email: string, token: string): Promise<void> {
    ltiToken.value = token
    devEmail.value = email
    isAuthenticated.value = true
    isLoading.value = false
  }

  function getDevEmail(): string | null {
    return devEmail.value
  }

  return {
    // State
    user: readonly(user),
    isLoading: readonly(isLoading),
    isAuthenticated: readonly(isAuthenticated),

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
