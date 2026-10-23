import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { env } from '@/env'
import { applyTheme } from '@/theme/applyTheme'
import { resolveTheme } from '@/theme'
import { useAuthStore } from '@/stores/auth.store'
import { takeLtiLaunch } from '@/services/lti-launch'

import '@/style.css'

function stripParams(keys: string[]): void {
  const clean = new URL(window.location.href)
  for (const k of keys) clean.searchParams.delete(k)
  window.history.replaceState({}, '', clean.toString())
}

/**
 * Boot sequence: theme → LTI launch fragment or the dev bridge or regular
 * Keycloak init → render. Auth is resolved *before* the first render so
 * route guards see a settled state.
 */
export async function bootstrap(): Promise<void> {
  applyTheme(resolveTheme(env.THEME))
  // Before anything else sees the URL: the fragment carries a session token.
  const ltiLaunch = takeLtiLaunch()

  const auth = useAuthStore.getState()
  const params = new URLSearchParams(window.location.search)

  // Dev-only bare-email bridge for running without Keycloak.
  const ssoHandoffDev = import.meta.env.DEV ? params.get('sso_handoff') : null

  if (ltiLaunch) {
    await auth.setLtiUser(ltiLaunch.email, ltiLaunch.token, ltiLaunch.role)
  } else if (ssoHandoffDev) {
    await auth.setDevUser(decodeURIComponent(ssoHandoffDev))
    stripParams(['sso_handoff'])
  } else {
    await auth.initialize()
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
