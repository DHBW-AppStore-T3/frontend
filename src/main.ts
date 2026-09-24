import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import router from '@/router/index'
import i18n from './i18n'
import { useAuthStore } from '@/stores/auth.store'
import type { UserRole } from '@/types'

import '@/style.css'

function mapLtiRole(role: string | null): UserRole {
  return role === 'instructor' ? 'teacher' : 'student'
}

;(async () => {
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.use(i18n)

  const auth = useAuthStore()
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
    const clean = new URL(window.location.href)
    for (const k of ['lti', 'email', 'name', 'course', 'courseId', 'role', 'session_token']) {
      clean.searchParams.delete(k)
    }
    window.history.replaceState({}, '', clean.toString())
  } else if (handoffEmail && handoffToken) {
    await auth.setHandoffUser(handoffEmail, handoffToken)
    const clean = new URL(window.location.href)
    for (const k of ['handoff', 'email', 'handoff_token']) {
      clean.searchParams.delete(k)
    }
    window.history.replaceState({}, '', clean.toString())
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
