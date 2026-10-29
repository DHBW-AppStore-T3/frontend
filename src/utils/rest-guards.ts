import type { DeploymentWithRelations, Task } from '@/types'

/**
 * Runtime checks of the REST answers the deployment detail page branches on
 * (issue 143, risk list in claude_docs/decisions/2026-rest-validierung-risikoliste.md).
 *
 * Tolerant: an answer without the fields the page cannot do without is rejected
 * (`null`, the caller treats it like a failed load); any other field of the wrong
 * type is dropped with a `console.warn`. Extra fields pass through untouched.
 */

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Copy of `data` without the optional fields whose value fails its check. */
function dropInvalid(what: string, data: Record<string, unknown>, checks: Record<string, (v: unknown) => boolean>) {
  const out = { ...data }
  for (const [key, ok] of Object.entries(checks)) {
    if (out[key] !== undefined && !ok(out[key])) {
      console.warn(`${what}: ignoring "${key}" of the wrong type`)
      delete out[key]
    }
  }
  return out
}

const isString = (v: unknown) => typeof v === 'string'
const isStringOrNull = (v: unknown) => v === null || typeof v === 'string'
const isNumberOrNull = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v))
const isRecordOrNull = (v: unknown) => v === null || isRecord(v)

const TASK_REQUIRED = ['taskId', 'type', 'status', 'created_at']

/** `GET /tasks/{id}` and the entries of the task list. */
export function parseTask(raw: unknown): Task | null {
  if (!isRecord(raw)) return null
  // `created_at` is sorted with `localeCompare`; `status` and `type` drive the page.
  if (!TASK_REQUIRED.every((k) => typeof raw[k] === 'string' && raw[k] !== '')) return null
  const out = dropInvalid('Task', raw, {
    logs: isStringOrNull,
    current_phase: isStringOrNull,
    progress_pct: isNumberOrNull,
    started_at: isStringOrNull,
    finished_at: isStringOrNull,
  })
  // The page reads `logs` as a required field: absent means none.
  if (out.logs === undefined) out.logs = null
  return out as unknown as Task
}

/** `GET /tasks/deployment/{id}`: unusable entries are dropped, a non-list is empty. */
export function parseTaskList(raw: unknown): Task[] {
  if (!Array.isArray(raw)) {
    console.warn('GET /tasks/deployment/{id}: expected a list')
    return []
  }
  const tasks: Task[] = []
  for (const entry of raw) {
    const task = parseTask(entry)
    if (task) tasks.push(task)
    else console.warn('GET /tasks/deployment/{id}: dropping an unusable entry')
  }
  return tasks
}

/** `GET /deployments/{id}`. */
export function parseDeploymentDetail(raw: unknown): DeploymentWithRelations | null {
  if (!isRecord(raw)) return null
  if (typeof raw.deploymentId !== 'string' || raw.deploymentId === '') return null
  if (typeof raw.status !== 'string') return null
  const out = dropInvalid('Deployment', raw, {
    name: isString,
    teams: Array.isArray,
    permissions: isRecord,
    outputs: isRecordOrNull,
    latest_task: isRecordOrNull,
    // The wizard's JSON arrives as text or already parsed.
    userInputVar: (v) => v === null || typeof v === 'string' || isRecord(v),
  })
  return out as unknown as DeploymentWithRelations
}

/** What the wizard stored in `userInputVar` (issue 120): only what the detail page reads. */
export interface StoredUserInput {
  groupNames: string[]
  assignments: Record<string, string[]>
  variables: Record<string, string>
}

/**
 * `userInputVar` as text or object. Anything that is not an object gives `null`;
 * the three parts are checked separately, a wrong part falls back to empty.
 */
export function parseStoredUserInput(raw: unknown): StoredUserInput | null {
  let value: unknown = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch (e) {
      console.error('Error parsing userInputVar:', e)
      return null
    }
  }
  if (!isRecord(value)) return null

  const groupNames = Array.isArray(value.groupNames)
    ? value.groupNames.map((n) => (typeof n === 'string' ? n : ''))
    : []

  const assignments: Record<string, string[]> = {}
  const rawAssignments = value.assignments
  if (isRecord(rawAssignments) || Array.isArray(rawAssignments)) {
    for (const [key, members] of Object.entries(rawAssignments)) {
      assignments[key] = Array.isArray(members) ? members.filter((m): m is string => typeof m === 'string') : []
    }
  } else if (rawAssignments !== undefined && rawAssignments !== null) {
    console.warn('userInputVar: ignoring "assignments" of the wrong type')
  }

  const variables: Record<string, string> = {}
  if (isRecord(value.variables)) {
    for (const [key, v] of Object.entries(value.variables)) variables[key] = typeof v === 'string' ? v : String(v ?? '')
  } else if (value.variables !== undefined && value.variables !== null) {
    console.warn('userInputVar: ignoring "variables" of the wrong type')
  }

  return { groupNames, assignments, variables }
}
