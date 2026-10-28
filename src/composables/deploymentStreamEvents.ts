/**
 * Runtime validation of the SSE payloads of ``/deployments/{id}/stream``.
 *
 * Every guard takes ``unknown`` and returns the typed value or ``null``.
 * Only the fields the UI reads are checked; unknown extra fields never make
 * an event invalid. Optional fields stay optional.
 *
 * Fields (backend ``snapshot_payload`` and the worker's ``progress``/``log``
 * events):
 *
 * * ``snapshot`` — nothing is mandatory (a deployment without task sends all
 *   nulls). ``status``, ``current_phase`` and ``progress_pct`` are read; they
 *   must be ``string|number|null`` when present. ``task_id`` and ``type`` are
 *   not read and not checked.
 * * ``progress`` — ``phase`` (string), ``phase_index``, ``total_phases`` and
 *   ``progress_pct`` (finite numbers) are required: they are written straight
 *   into the state. ``phase_names`` is optional; a non-array is ignored as
 *   before, an array with a non-string entry invalidates the event.
 * * ``log`` — ``level`` and ``message`` (strings) are required. The time comes
 *   from ``iso_timestamp``, else ``timestamp``; either must be a string when
 *   present. ``tool`` (string), ``streaming`` (boolean) and ``category``
 *   (string) are optional. All other fields pass through untouched.
 */

export interface LogEntry {
  timestamp: string
  level: string
  message: string
  category?: string
  tool?: string
  streaming?: boolean
  // Further worker fields (phase, progress_pct, returncode, ...) pass through unread.
  [key: string]: unknown
}

export interface ProgressEvent {
  phase: string
  phase_index: number
  total_phases: number
  progress_pct: number
  // Full ordered phase-name sequence for the active task. The worker
  // ships the authoritative list with every event; the UI only falls
  // back to its static phase tables before the first event.
  phase_names?: string[]
}

export interface SnapshotEvent {
  status: string | null
  current_phase: string | null
  progress_pct: number | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/** `undefined` and `null` both mean "not sent"; anything else must pass `check`. */
const optional = <T>(value: unknown, check: (v: unknown) => v is T): { ok: true; value: T | undefined } | { ok: false } => {
  if (value === undefined || value === null) return { ok: true, value: undefined }
  return check(value) ? { ok: true, value } : { ok: false }
}

const isString = (value: unknown): value is string => typeof value === 'string'
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

export function parseSnapshot(data: unknown): SnapshotEvent | null {
  if (!isRecord(data)) return null
  const status = optional(data.status, isString)
  const phase = optional(data.current_phase, isString)
  const progress = optional(data.progress_pct, isFiniteNumber)
  if (!status.ok || !phase.ok || !progress.ok) return null
  return {
    status: status.value ?? null,
    current_phase: phase.value ?? null,
    progress_pct: progress.value ?? null,
  }
}

export function parseProgress(data: unknown): ProgressEvent | null {
  if (!isRecord(data)) return null
  const { phase, phase_index, total_phases, progress_pct, phase_names } = data
  if (!isString(phase) || !isFiniteNumber(phase_index) || !isFiniteNumber(total_phases) || !isFiniteNumber(progress_pct)) {
    return null
  }
  const event: ProgressEvent = { phase, phase_index, total_phases, progress_pct }
  if (Array.isArray(phase_names)) {
    if (!phase_names.every(isString)) return null
    event.phase_names = phase_names
  }
  return event
}

/**
 * `now` is the fallback time for a log without a timestamp (as before); it is
 * injected to keep the function pure.
 */
export function parseLog(data: unknown, now: () => string = () => new Date().toISOString()): LogEntry | null {
  if (!isRecord(data)) return null
  const { level, message } = data
  if (!isString(level) || !isString(message)) return null

  const iso = optional(data.iso_timestamp, isString)
  const plain = optional(data.timestamp, isString)
  const tool = optional(data.tool, isString)
  const category = optional(data.category, isString)
  const streaming = optional(data.streaming, isBoolean)
  if (!iso.ok || !plain.ok || !tool.ok || !category.ok || !streaming.ok) return null

  // Worker logs ship the human-readable ISO time as ``iso_timestamp``
  // (once because Celery reserved ``timestamp`` for a Unix-time
  // float; the name stayed). Re-key to ``timestamp`` for downstream
  // consumers that don't need to know that detail.
  const entry: LogEntry = { ...data, level, message, timestamp: iso.value || plain.value || now() }
  // An explicit null means "not sent" for the optional fields; keep the type honest.
  if (tool.value === undefined) delete entry.tool
  if (category.value === undefined) delete entry.category
  if (streaming.value === undefined) delete entry.streaming
  return entry
}
