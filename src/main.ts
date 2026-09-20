import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import router from '@/router/index'
import i18n from './i18n'
import { useAuthStore } from '@/stores/auth.store'

import '@/style.css'

;(async () => {
    const app = createApp(App)
    app.use(createPinia())
    app.use(router)
    app.use(i18n)

    const auth = useAuthStore()
    const params = new URLSearchParams(window.location.search)

    // LTI launch: backend redirects here with ?lti=1&email=...&session_token=...
    // Works in both dev and production — no DEV guard.
    const ltiEmail = params.get('lti') === '1' ? params.get('email') : null
    const ltiToken = params.get('session_token')

    // SSO bridge from self-service-ui: dev-only, passes user via ?sso_handoff=email
    const ssoHandoff = import.meta.env.DEV ? params.get('sso_handoff') : null

    if (ltiEmail && ltiToken) {
        const ltiRoleRaw = params.get('role') ?? 'student'
        const ltiRole = ltiRoleRaw === 'instructor' ? 'teacher' : ltiRoleRaw as import('@/types').UserRole
        await auth.setLtiUser(ltiEmail, ltiToken, ltiRole)
        const clean = new URL(window.location.href)
        for (const k of ['lti', 'email', 'name', 'course', 'courseId', 'role', 'synced', 'session_token']) {
            clean.searchParams.delete(k)
        }
        window.history.replaceState({}, '', clean.toString())
    } else if (ssoHandoff) {
        // SSO bridge: set up the user BEFORE mounting so the router guard sees isAuthenticated=true.
        await auth.setDevUser(decodeURIComponent(ssoHandoff))
        const clean = new URL(window.location.href)
        clean.searchParams.delete('sso_handoff')
        window.history.replaceState({}, '', clean.toString())
    } else {
        await auth.initialize()
    }

    app.mount('#app')
})()

