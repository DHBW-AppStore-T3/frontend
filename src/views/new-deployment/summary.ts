/**
 * Pure presentation logic of the wizard's summary step: turning draft values
 * and variable definitions into display rows, and backend errors into messages.
 */
import { isOsResourceVar, type AppVariable, type DeploymentFile } from '@/types'
import { formatBytes } from '@/utils/format'
import { isMultiImagePackerLayout, packerValueFor } from '@/utils/draft-variables'

type Translate = (key: string, options?: Record<string, unknown>) => string
type OsType = NonNullable<AppVariable['osType']>
type DisplayLookup = (
  osType: any,
  mode: 'id' | 'name',
  value: string,
) => { name: string; known?: boolean } | null

export interface SummaryEntry {
  label: string
  value: string
  /** Submitted raw value, shown as tooltip when it differs from the display. */
  raw?: string
}

export interface SummaryContext {
  t: Translate
  getDisplayName: DisplayLookup
}

const BYTES_PER_MB = 1024 * 1024
const MB_DECIMALS = 1
const EMPTY = '-'

export function formatValue(val: unknown, t: Translate): string {
  if (typeof val === 'boolean') return val ? t('deployment.summary.yes') : t('deployment.summary.no')
  if (Array.isArray(val)) return val.map((item) => String(item).replace(/^"|"$/g, '')).join(', ')
  if (typeof val === 'string') return val.replace(/^["'[]+|["'\]]+$/g, '') || EMPTY
  if (val === null || val === undefined || val === '') return EMPTY
  return String(val)
}

/**
 * Display string for an OpenStack-marker value: names from the display cache
 * (single or comma-separated for multi), falling back to the raw value.
 */
export function renderOsValue(
  osType: OsType,
  mode: 'id' | 'name',
  val: unknown,
  isMulti: boolean,
  getDisplayName: DisplayLookup,
): string {
  if (val === null || val === undefined || val === '') return EMPTY

  let parts: string[]
  if (Array.isArray(val)) parts = val.map((v) => String(v).trim()).filter(Boolean)
  else if (typeof val === 'string') {
    parts = isMulti
      ? val.split(',').map((s) => s.trim()).filter(Boolean)
      : [val.trim()].filter(Boolean)
  } else parts = [String(val)]

  if (parts.length === 0) return EMPTY
  return parts.map((p) => getDisplayName(osType, mode, p)?.name ?? p).join(', ')
}

/**
 * The row for one variable. Marker variables show the cached display name
 * (the raw value as tooltip in id-mode); scoped variables render one
 * ``slot: value`` segment per recipient.
 */
export function toSummaryEntry(def: AppVariable, val: unknown, ctx: SummaryContext): SummaryEntry {
  const { t, getDisplayName } = ctx
  const display = (raw: unknown) =>
    def.osType && isOsResourceVar(def)
      ? renderOsValue(def.osType, def.osMode || 'name', raw, !!def.osMulti, getDisplayName)
      : formatValue(raw, t)

  if ((def.varScope === 'team' || def.varScope === 'user') && def.osType !== 'file') {
    if (!val || typeof val !== 'object' || Array.isArray(val)) return { label: def.name, value: EMPTY }
    const entries = Object.entries(val as Record<string, unknown>)
    if (entries.length === 0) return { label: def.name, value: EMPTY }
    return { label: def.name, value: entries.map(([slot, raw]) => `${slot}: ${display(raw)}`).join(' · ') }
  }

  if (def.osType && isOsResourceVar(def)) {
    const shown = display(val)
    const rawString = formatValue(val, t)
    return { label: def.name, value: shown, raw: shown !== rawString ? rawString : undefined }
  }
  return { label: def.name, value: formatValue(val, t) }
}

export function buildPackerEntries(
  defs: AppVariable[],
  variables: Record<string, any> | null | undefined,
  ctx: SummaryContext,
): SummaryEntry[] {
  const multi = isMultiImagePackerLayout(variables)
  return defs
    .filter((d) => d.source === 'packer')
    .map((def) => {
      const value = packerValueFor(def, variables)
      const entry = toSummaryEntry(def, value === undefined ? def.default : value, ctx)
      // In multi-image mode name the image the value belongs to.
      return multi ? { ...entry, label: `[${def.template_key ?? 'default'}] ${entry.label}` } : entry
    })
}

export function buildTerraformEntries(
  defs: AppVariable[],
  variables: Record<string, any> | null | undefined,
  ctx: SummaryContext,
): SummaryEntry[] {
  const current = variables || {}
  return (
    defs
      // File variables have a separate renderer: their ``default = {}`` is not the upload.
      .filter((d) => d.source === 'terraform' && d.osType !== 'file')
      .map((def) => toSummaryEntry(def, current[def.name] !== undefined ? current[def.name] : def.default, ctx))
  )
}

export interface FileSummary {
  name: string
  scope: 'all' | 'team' | 'user'
  chips: { slot: string; filename: string; size: string }[]
}

/** One card per file variable; chips show filename and size, never the content. */
export function buildFileSummaries(
  defs: AppVariable[],
  uploads: Record<string, Record<string, DeploymentFile | null>> | undefined,
): FileSummary[] {
  return defs
    .filter((d) => d.osType === 'file')
    .map((def) => {
      const slotMap = uploads?.[def.name] || {}
      const chips = Object.entries(slotMap)
        .filter(([, file]) => !!file)
        .map(([slot, file]) => ({ slot, filename: file!.name, size: formatBytes(file!.size || 0) }))
      return { name: def.name, scope: (def.osScope || 'all') as FileSummary['scope'], chips }
    })
}

const toMb = (bytes: unknown) => (Number(bytes || 0) / BYTES_PER_MB).toFixed(MB_DECIMALS)

/**
 * User-facing message for a failed submit. The backend signals size, extension
 * and encoding violations (413/422) with a structured ``detail``; every known
 * reason maps to an i18n key with the numbers the user needs. Unknown shapes
 * fall back to a string detail, the error message, or the generic key.
 */
// Errors the API names with `detail.code`.
const CODE_MESSAGES: Record<string, string> = {
  version_not_approved: 'deployment.summary.errors.version_not_approved',
  app_deactivated: 'deployment.summary.errors.app_deactivated',
  role_required: 'deployment.summary.errors.role_required',
}

// Errors the API names with `detail.reason` that need no more than a text
// (team, workload, credential, app spec and version problems).
const REASONS_WITH_MESSAGE = new Set([
  'invalid_teams',
  'unknown_team_member',
  'member_in_several_teams',
  'team_names_collide',
  'no_workloads',
  'too_many_workloads',
  'openstack_credentials_missing',
  'openstack_credential_not_found',
  'openstack_credentials_unverified',
  'auth_url_not_allowed',
  'invalid_app_spec',
  'version_moved',
  'version_required',
  'git_unreachable',
  'git_host_not_allowed',
])

export function formatSubmitError(err: any, t: Translate): string {
  const detail = err?.response?.data?.detail
  const fallback =
    (typeof detail === 'string' ? detail : null) ?? err?.message ?? t('deployment.summary.submitError')

  if (detail && typeof detail === 'object' && detail.code && CODE_MESSAGES[detail.code]) {
    return t(CODE_MESSAGES[detail.code]!)
  }
  if (!detail || typeof detail !== 'object' || !detail.reason) return fallback

  const filename = String(
    detail.filename ?? (detail.variable && detail.slot ? `${detail.variable}/${detail.slot}` : ''),
  )

  switch (detail.reason) {
    case 'file_too_large':
      return t('deployment.summary.errors.fileTooLarge', {
        filename,
        actualMb: toMb(detail.actual_bytes),
        limitMb: toMb(detail.limit_bytes),
      })
    case 'deployment_files_too_large':
      return t('deployment.summary.errors.deploymentFilesTooLarge', { limitMb: toMb(detail.limit_bytes) })
    case 'file_extension_rejected':
      return t('deployment.summary.errors.fileExtensionRejected', {
        filename,
        allowed: Array.isArray(detail.allowed) ? detail.allowed.join(', ') : '',
      })
    case 'file_b64_invalid':
      return t('deployment.summary.errors.fileB64Invalid', { filename })
    case 'file_size_mismatch':
      return t('deployment.summary.errors.fileSizeMismatch', { filename })
    case 'workload_budget_exceeded':
      return t('deployment.summary.errors.workload_budget_exceeded', {
        inUse: detail.in_use ?? 0,
        requested: detail.requested ?? 0,
        budget: detail.budget ?? 0,
      })
    default:
      return REASONS_WITH_MESSAGE.has(detail.reason)
        ? t(`deployment.summary.errors.${detail.reason}`, { limit: detail.limit ?? '', workloads: detail.workloads ?? '' })
        : fallback
  }
}

/** The release tag may arrive as string or ``{version}`` object. */
export function versionLabelOf(releaseTag: unknown): string {
  if (releaseTag && typeof releaseTag === 'object' && (releaseTag as { version?: string }).version) {
    return (releaseTag as { version: string }).version
  }
  if (typeof releaseTag === 'string' && releaseTag.trim() !== '') return releaseTag
  return 'latest'
}
