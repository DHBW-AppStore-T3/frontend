/**
 * Pure presentation logic of the wizard's summary step: turning draft values
 * and variable definitions into display rows, and backend errors into messages.
 */
import type { AppVariable, DeploymentFile, StoredValues } from '@/types'
import { formatBytes } from '@/utils/format'

type Translate = (key: string, options?: Record<string, unknown>) => string

export interface SummaryEntry {
  label: string
  value: string
  /** Submitted raw value, shown as tooltip when it differs from the display. */
  raw?: string
}

export interface SummaryContext {
  t: Translate
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

/** The row for one variable; scoped variables render one ``slot: value`` segment per recipient. */
export function toSummaryEntry(def: AppVariable, val: unknown, ctx: SummaryContext): SummaryEntry {
  const { t } = ctx

  if ((def.varScope === 'team' || def.varScope === 'user') && def.osType !== 'file') {
    if (!val || typeof val !== 'object' || Array.isArray(val)) return { label: def.name, value: EMPTY }
    const entries = Object.entries(val as Record<string, unknown>)
    if (entries.length === 0) return { label: def.name, value: EMPTY }
    return { label: def.name, value: entries.map(([slot, raw]) => `${slot}: ${formatValue(raw, t)}`).join(' · ') }
  }

  return { label: def.name, value: formatValue(val, t) }
}

export function buildTerraformEntries(
  defs: AppVariable[],
  variables: StoredValues | null | undefined,
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
// (team, workload, app spec and version problems).
const REASONS_WITH_MESSAGE = new Set([
  'invalid_teams',
  'unknown_team_member',
  'member_in_several_teams',
  'team_names_collide',
  'no_workloads',
  'too_many_workloads',
  'invalid_app_spec',
  'appstore_yaml_missing',
  'runtime_not_supported',
  'version_moved',
  'version_required',
  'git_unreachable',
  'git_host_not_allowed',
  'upload_scan_unavailable',
])

/** Codes of ``file_content_rejected`` (backend ``app/services/upload_validation.py``) that have a translation. */
const FILE_CONTENT_CODES = new Set([
  'zip_invalid',
  'zip_empty',
  'zip_too_many_entries',
  'zip_bad_name',
  'zip_absolute_path',
  'zip_path_traversal',
  'zip_duplicate_entry',
  'zip_encrypted',
  'zip_compression',
  'zip_special_file',
  'zip_entry_too_large',
  'zip_overlapping_entries',
  'zip_bomb',
  'zip_corrupt',
  'zip_size_mismatch',
  'svg_invalid',
  'svg_active_content',
  'executable_not_allowed',
  'archive_not_inspectable',
  'content_type_mismatch',
  'pdf_encrypted',
  'pdf_active_content',
  'pdf_unscannable',
  'pdf_invalid',
  'image_invalid',
  'image_too_large',
  'image_trailing_data',
  'malware_detected',
])

/**
 * The structured ``detail`` of a 413/422 on submit. The fields are what the backend
 * sends for the reasons handled below; they are not validated, each read behaves as
 * it did on untyped data.
 */
interface SubmitErrorDetail {
  code?: string
  reason?: string
  message?: string
  filename?: string
  variable?: string
  slot?: string
  actual_bytes?: number
  limit_bytes?: number
  allowed?: string[]
  in_use?: number
  requested?: number
  budget?: number
  limit?: number
  workloads?: number
}

/** The parts of a failed submit this message reads; the thrown value itself is ``unknown``. */
interface SubmitFailure {
  message?: string
  response?: { data?: { detail?: SubmitErrorDetail | string | null } }
}

export function formatSubmitError(error: unknown, t: Translate): string {
  const err = error as SubmitFailure | null | undefined
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
    case 'file_content_rejected': {
      // The server names the problem by a stable code; unknown codes show its English message.
      const code = typeof detail.code === 'string' ? detail.code : ''
      const reason = FILE_CONTENT_CODES.has(code)
        ? t(`deployment.summary.errors.fileContent.${code}`)
        : String(detail.message ?? '')
      return t('deployment.summary.errors.fileContentRejected', { filename, reason })
    }
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
