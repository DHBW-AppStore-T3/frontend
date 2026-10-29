import type { AppDetail } from './versionInfo'

/**
 * Runtime check of ``GET /apps/{id}`` (issue 143). The view branches on
 * ``versions``, ``deploy_version``, ``is_private`` and the owner, and renders
 * ``name``; a wrong shape there crashes the page or shows the wrong rights.
 *
 * Tolerant on purpose: an answer without a usable ``appId``/``name`` is rejected
 * (``null``, the caller treats it like a failed load); any other field of the
 * wrong type is dropped with a warning, so the page renders with the field
 * missing. Extra fields pass through untouched.
 */
export function parseAppDetail(raw: unknown): AppDetail | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const data = raw as Record<string, unknown>
  if (typeof data.appId !== 'string' || data.appId === '') return null
  if (typeof data.name !== 'string') return null

  const out: Record<string, unknown> = { ...data }
  const drop = (key: string, ok: boolean) => {
    if (key in out && out[key] !== undefined && !ok) {
      console.warn(`GET /apps/{id}: ignoring "${key}" of the wrong type`)
      delete out[key]
    }
  }

  drop('versions', Array.isArray(out.versions))
  drop('deploy_version', out.deploy_version === null || typeof out.deploy_version === 'string')
  drop('is_private', typeof out.is_private === 'boolean')
  drop('userId', typeof out.userId === 'string')
  const user = out.user
  drop('user', user === null || (typeof user === 'object' && !Array.isArray(user)))

  return out as AppDetail
}
