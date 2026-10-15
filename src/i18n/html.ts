import i18n from './index'

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c])
}

/**
 * Translate a message that contains trusted markup (e.g. ``<strong>{name}</strong>``)
 * for use with ``dangerouslySetInnerHTML``. Interpolated params are HTML-escaped
 * so user-controlled values (course/app/deployment names) cannot inject markup.
 */
export function translateHtml(key: string, params: Record<string, unknown> = {}): string {
  const safe = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, typeof v === 'string' ? escapeHtml(v) : v]),
  )
  return i18n.t(key, safe) as string
}
