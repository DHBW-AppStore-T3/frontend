import api from '@/api/axios'
import type { UserRole } from '@/types'

export interface LtiLaunch {
  email: string
  token: string
  role: UserRole
}

const LTI_FLAG = 'lti'
const LTI_FLAG_VALUE = '1'

/**
 * Moodle LTI 1.3 launch: after validating it, the backend sends the browser
 * here with `#lti=1&code=...`, a one-time code. The fragment is never sent to
 * a server, so the code stays out of access logs and Referer headers. It is
 * read and removed from the address bar before the router sees the URL.
 *
 * The code alone signs nobody in: `redeemLtiCode` needs the cookie the launch
 * set in this browser. A session token in the URL is not accepted any more
 * (a crafted link with one used to sign the visitor in as somebody else).
 * Parameters in the query string are ignored.
 */
export function takeLtiLaunch(): string | null {
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  if (fragment.get(LTI_FLAG) !== LTI_FLAG_VALUE) return null

  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)

  return fragment.get('code') || null
}

interface LtiSessionResponse {
  session_token: string
  email: string
  role: UserRole
}

/**
 * Trade the launch's code for a session. The launch's binding cookie
 * (HttpOnly, on the API's `/lti13` path) goes with the request; the role is
 * the API's, and only shapes the UI until `/users/me` answers.
 */
export async function redeemLtiCode(code: string): Promise<LtiLaunch> {
  const { data } = await api.post<LtiSessionResponse>('/lti13/session', { code }, { withCredentials: true })
  return { email: data.email, token: data.session_token, role: data.role }
}
