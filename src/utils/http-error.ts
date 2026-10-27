/**
 * HTTP/axios error helpers.
 *
 * The backend returns error detail in two shapes: a plain string, or a
 * structured object (e.g. ``{ reason, message }`` for a 412
 * PRECONDITION_FAILED). Plain interpolation would print
 * ``[object Object]`` for the dict case, so :func:`extractErrorMessage`
 * drills into ``.reason`` / ``.message`` when present and falls back to
 * ``err.message`` so a toast is always readable.
 */

/**
 * Turn an axios-style error into a human-readable string.
 *
 * `fallback` is used when the error carries nothing usable. Pass an
 * action-specific message ("Failed to load apps") where one exists; the
 * default keeps the old behaviour for callers that have nothing better.
 *
 * This is the only implementation. There were three: this one, a local
 * `extractError` in the OpenStack credentials store, and a fourth copy
 * inlined into every store action that had not adopted `runRequest`.
 */
export function extractErrorMessage(err: unknown, fallback = 'Unknown error'): string {
  const e = err as {
    response?: { data?: { detail?: unknown } }
    message?: string
  }
  const detail = e?.response?.data?.detail
  if (typeof detail === 'string' && detail) return detail
  if (detail && typeof detail === 'object') {
    const d = detail as { reason?: unknown; message?: unknown }
    if (typeof d.reason === 'string') return d.reason
    if (typeof d.message === 'string') return d.message
  }
  return e?.message || fallback
}

/**
 * The ``message`` of whatever was thrown, or undefined when it has none (not an
 * object, no ``message``, or an empty one). Unlike :func:`extractErrorMessage`
 * it never looks at ``response.data.detail``: for errors that do not come from
 * an API call (Keycloak, redirects) the error's own text is the message.
 */
export function thrownMessage(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined
  const { message } = err as { message?: unknown }
  return typeof message === 'string' && message ? message : undefined
}

/**
 * The machine-readable reason of an API error (`detail.reason` or
 * `detail.code`), or null.
 */
export function errorReason(err: unknown): string | null {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (detail && typeof detail === 'object') {
    const d = detail as { reason?: unknown; code?: unknown }
    if (typeof d.reason === 'string') return d.reason
    if (typeof d.code === 'string') return d.code
  }
  return null
}

/**
 * A readable message for an API error: the translation `errors.<reason>`
 * when the API names a reason the UI knows (`exists` from i18next), else
 * `extractErrorMessage`. The detail's fields are passed as parameters.
 */
export function localizedError(
  err: unknown,
  t: (key: string, params?: Record<string, unknown>) => string,
  exists: (key: string) => boolean,
  fallback = 'Unknown error',
): string {
  const reason = errorReason(err)
  if (reason && exists(`errors.${reason}`)) {
    const detail = (err as { response?: { data?: { detail?: Record<string, unknown> } } })?.response?.data?.detail
    return t(`errors.${reason}`, { ...(detail ?? {}) })
  }
  return extractErrorMessage(err, fallback)
}
