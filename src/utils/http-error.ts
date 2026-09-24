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
