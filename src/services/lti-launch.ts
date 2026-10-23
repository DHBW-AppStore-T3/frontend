import type { UserRole } from '@/types'

export interface LtiLaunch {
  email: string
  token: string
  role: UserRole
}

const LTI_FLAG = 'lti'
const LTI_FLAG_VALUE = '1'

/** Moodle names the teaching role `instructor`; everyone else is a student. */
export function mapLtiRole(role: string | null): UserRole {
  return role === 'instructor' ? 'teacher' : 'student'
}

/**
 * Moodle LTI 1.3 launch: after validating it, the backend sends the browser
 * here with `#lti=1&email=...&role=...&session_token=...`. The fragment is
 * never sent to a server, so the token stays out of access logs and Referer
 * headers. It is read and removed from the address bar before the router
 * sees the URL. The role only shapes the UI until `/users/me` answers; the
 * API decides by the token.
 *
 * Parameters in the query string are ignored: the token never travels there.
 */
export function takeLtiLaunch(): LtiLaunch | null {
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  if (fragment.get(LTI_FLAG) !== LTI_FLAG_VALUE) return null

  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)

  const email = fragment.get('email')
  const token = fragment.get('session_token')
  if (!email || !token) return null
  return { email, token, role: mapLtiRole(fragment.get('role')) }
}
