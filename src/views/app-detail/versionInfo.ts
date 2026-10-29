import type { App, AppVersionApproval } from '@/types'

/**
 * The app detail response: the schema's ``AppResponse`` (frontend#87) with every
 * field but ``appId`` / ``name`` optional, because the view also gets partial
 * objects (after an edit, in tests). UI-side additions: ``versions``, loosely typed
 * (strings or objects, see ``versionDetailsOf``), ``user`` reduced to what the view
 * shows, and the legacy ``id`` / ``_id`` that ``deleteApp`` still falls back to.
 */
export type AppDetail = Pick<App, 'appId' | 'name'> &
  Partial<Omit<App, 'appId' | 'name'>> & {
    id?: string
    _id?: string
    user?: { username?: string }
    versions?: unknown[]
  }

type VersionRecord = Record<string, unknown>

const isRecord = (v: unknown): v is VersionRecord => typeof v === 'object' && v !== null

function tagOf(entry: unknown): string {
  if (typeof entry === 'string') return entry
  if (!isRecord(entry)) return ''
  return String(entry.version || entry.releaseTag || '')
}

export function versionOptionsOf(app: AppDetail | null): string[] {
  return (app?.versions ?? []).map(tagOf).filter(Boolean)
}

/** Version users deploy: the admin's choice if it is still listed, else the first version. */
export function deployVersionOf(app: AppDetail | null, versionOptions: string[]): string {
  const chosen = app?.deploy_version
  return chosen && versionOptions.includes(chosen) ? chosen : (versionOptions[0] ?? '')
}

/** Details object of the selected version; plain-string versions become ``{ version }``. */
export function versionDetailsOf(app: AppDetail | null, selected: string): VersionRecord | null {
  if (!app?.versions || !selected) return null
  const match = app.versions.find((v) => {
    if (typeof v === 'string') return v === selected
    return isRecord(v) && (v.version === selected || v.releaseTag === selected || v.tag === selected)
  })
  if (!match) return null
  return typeof match === 'string' ? { version: match } : (match as VersionRecord)
}

const DETAIL_KEYS = [
  'name',
  'type',
  'commit',
  'description',
  'author',
  'published_at',
  'prerelease',
  'html_url',
  'commit_sha',
  'commit_author',
  'commit_date',
  'url',
]

export function hasVersionInfo(details: VersionRecord | null): boolean {
  return !!details && DETAIL_KEYS.some((k) => Boolean(details[k]))
}

export interface VersionInfo {
  name: string
  type: string
  commit: string
  description: string
  author: string
  published_at: string
  prerelease: string | boolean
  html_url: string
}

export function toVersionInfo(details: VersionRecord | null): VersionInfo | null {
  if (!details) return null
  const str = (...keys: string[]) => {
    for (const k of keys) if (details[k] != null && details[k] !== '') return String(details[k])
    return ''
  }
  return {
    name: str('name'),
    type: str('type'),
    commit: str('commit', 'commit_sha'),
    description: str('description'),
    author: str('author', 'commit_author'),
    published_at: str('published_at', 'commit_date'),
    prerelease: (details.prerelease as string | boolean | undefined) ?? '',
    html_url: str('html_url', 'url'),
  }
}

export type BannerStatus = 'none' | 'no_submission' | 'pending' | 'approved'

/** Status banner of the store tab. */
export function bannerStatusOf(app: AppDetail | null, approvals: AppVersionApproval[]): BannerStatus {
  if (!app || app.is_private) return 'none'
  if (approvals.some((a) => a.status === 'approved')) return 'approved'
  if (approvals.some((a) => a.status === 'pending')) return 'pending'
  return 'no_submission'
}

export function indexApprovalsByVersion(approvals: AppVersionApproval[]): Record<string, AppVersionApproval> {
  const map: Record<string, AppVersionApproval> = {}
  for (const a of approvals) map[a.version_tag] = a
  return map
}
