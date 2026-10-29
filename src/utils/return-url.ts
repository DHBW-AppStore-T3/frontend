/**
 * A post-login destination must stay inside this app: a path that starts with a
 * single ``/``. ``//host`` and ``/\\host`` are read by browsers as another origin,
 * and ``https://...``, ``javascript:`` or a relative ``foo`` are not app paths.
 * The value comes from the query string (``/login?returnUrl=``) and from
 * ``sessionStorage``, so it is not trusted.
 */
export function safeReturnUrl(raw: unknown, fallback = '/'): string {
  if (typeof raw !== 'string' || raw === '') return fallback
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  // Control characters (tab, newline) are dropped by URL parsers: `/\t/evil.com` becomes `//evil.com`.
  // eslint-disable-next-line no-control-regex -- the point of the check
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback
  return raw
}
