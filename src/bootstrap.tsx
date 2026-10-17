import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { env } from '@/env'
import { applyTheme } from '@/theme/applyTheme'
import { resolveTheme } from '@/theme'
import { useAuthStore } from '@/stores/auth.store'
import type { UserRole } from '@/types'

import '@/style.css'

function mapLtiRole(role: string | null): UserRole {
  return role === 'instructor' ? 'teacher' : 'student'
}

function stripParams(keys: string[]): void {
  const clean = new URL(window.location.href)
  for (const k of keys) clean.searchParams.delete(k)
  window.history.replaceState({}, '', clean.toString())
}

/**
 * Boot sequence: theme → auth handoff params (LTI / self-service-ui / dev
 * bridge) or regular Keycloak init → render. Auth is resolved *before* the
 * first render so route guards see a settled state.
 */
export async function bootstrap(): Promise<void> {
  applyTheme(resolveTheme(env.THEME))

  const auth = useAuthStore.getState()
  const params = new URLSearchParams(window.location.search)

  // Moodle LTI 1.3 launch: backend redirects here with
  // ?lti=1&email=...&role=...&session_token=... after validating the launch.
  const ltiEmail = params.get('lti') === '1' ? params.get('email') : null
  const ltiToken = params.get('session_token')

  // self-service-ui handoff: backend-verified, production-safe — no DEV guard.
  const handoffEmail = params.get('handoff') === '1' ? params.get('email') : null
  const handoffToken = params.get('handoff_token')

  // Dev-only bare-email bridge, only usable when self-service-ui isn't running locally.
  const ssoHandoffDev = import.meta.env.DEV ? params.get('sso_handoff') : null

  if (ltiEmail && ltiToken) {
    await auth.setLtiUser(ltiEmail, ltiToken, mapLtiRole(params.get('role')))
    stripParams(['lti', 'email', 'name', 'course', 'courseId', 'role', 'session_token'])
  } else if (handoffEmail && handoffToken) {
    await auth.setHandoffUser(handoffEmail, handoffToken)
    stripParams(['handoff', 'email', 'handoff_token'])
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
