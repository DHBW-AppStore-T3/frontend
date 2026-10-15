import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import router from '@/router/index'
import i18n from './i18n'
import { env } from '@/env'
import { applyTheme } from '@/theme/applyTheme'
import { resolveTheme } from '@/theme'
import { useAuthStore } from '@/stores/auth.store'
import type { UserRole } from '@/types'

import '@/style.css'

function mapLtiRole(role: string | null): UserRole {
  return role === 'instructor' ? 'teacher' : 'student'
}

interface LtiLaunch {
  email: string
  token: string
  role: UserRole
}

/**
 * Moodle LTI 1.3 launch: after validating it, the backend sends the browser
 * here with ``#lti=1&email=...&role=...&session_token=...``. The fragment is
 * never sent to a server, so the token stays out of access logs and Referer
 * headers. It is read and removed from the address bar before the router
 * sees the URL. The role only shapes the UI until ``/users/me`` answers; the
 * API decides by the token.
 */
function takeLtiLaunch(): LtiLaunch | null {
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  if (fragment.get('lti') !== '1') return null
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
  const email = fragment.get('email')
  const token = fragment.get('session_token')
  if (!email || !token) return null
  return { email, token, role: mapLtiRole(fragment.get('role')) }
}

;(async () => {
  applyTheme(resolveTheme(env.THEME))
  const ltiLaunch = takeLtiLaunch()

  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.use(i18n)

  const auth = useAuthStore()
  const params = new URLSearchParams(window.location.search)

  // Dev-only bare-email bridge, only usable when self-service-ui isn't running locally.
  const ssoHandoffDev = import.meta.env.DEV ? params.get('sso_handoff') : null

  if (ltiLaunch) {
    await auth.setLtiUser(ltiLaunch.email, ltiLaunch.token, ltiLaunch.role)
  } else if (ssoHandoffDev) {
    await auth.setDevUser(decodeURIComponent(ssoHandoffDev))
    const clean = new URL(window.location.href)
    clean.searchParams.delete('sso_handoff')
    window.history.replaceState({}, '', clean.toString())
  } else {
    await auth.initialize()
  }

  app.mount('#app')
})()
