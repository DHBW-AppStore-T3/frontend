/**
 * Pure helpers for the deployment detail page: output/credential extraction,
 * member ↔ account matching, status presentation and small parsers. Kept free
 * of React so they are trivially unit-testable.
 */
import {
  CheckCircle,
  Loader2,
  Clock,
  XCircle,
  StopCircle,
  Flame,
  PauseCircle,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react'
import type { DeploymentTeam, Task } from '@/types'

// One account entry as an app publishes it (VM apps: Terraform outputs; pods:
// the platform's own access data). Only ever the caller's own (`/my-access`).
export interface UserAccount {
  username?: string | null
  team?: string
  ip?: string
  port?: number
  auth?: string
  type?: 'password' | 'ssh_key' | 'oauth' | 'none' | string
  authtype?: 'ssh' | 'url' | 'rdp' | string
  url?: string | null
  /** Pod apps: whose account this is and which workload it opens. */
  user_id?: string
  workload?: string
}

export interface TeamVm {
  url?: string | null
  floating_ip?: string
  fixed_ip?: string
  workloads?: string[]
}

export type UserAccountMap = Record<string, UserAccount>
export type TeamVmMap = Record<string, TeamVm>

export interface AccountHit {
  key: string
  data: UserAccount
}

/**
 * Team-level, non-secret data (the URL of a team's app): the owner view reads
 * every team's from the redacted outputs of the detail response, a member
 * their own team's from `/my-access`.
 */
export function teamVmsOf(
  outputs: unknown,
  mine: TeamVmMap | null,
): TeamVmMap {
  const rawOutputs = (outputs as { raw?: Record<string, { value?: unknown } | undefined> } | null | undefined)?.raw
  const raw = (rawOutputs?.team_endpoints ?? rawOutputs?.team_vms)?.value
  if (raw && typeof raw === 'object') return raw as TeamVmMap
  return mine ?? {}
}

/** The caller's own account: `/my-access` names exactly one, or none. */
export function ownAccountOf(accounts: UserAccountMap | null): AccountHit | null {
  const entries = Object.entries(accounts ?? {})
  if (entries.length !== 1) return null
  const [key, data] = entries[0]!
  return { key, data }
}

/**
 * Teams with their members. Only the caller's own row carries credentials:
 * the owner view's outputs have every account redacted, and matching accounts
 * to other members by name could hand one person another's password
 * (.github#7 H). The row is found by user id, never by a name heuristic.
 */
export function enrichTeams(
  teams: DeploymentTeam[] | undefined,
  teamVms: TeamVmMap,
  ownUserId: string | null | undefined,
  ownAccount: AccountHit | null,
) {
  if (!teams) return []
  return teams.map((team) => ({
    ...team,
    vm: teamVms[team.name] ?? null,
    members: team.members.map((member) => ({
      ...member,
      account: ownUserId && String(member.userId) === String(ownUserId) ? ownAccount : null,
    })),
  }))
}

/**
 * Count of log entries for the Logs card badge. Logs arrive as an object
 * ``{logs: [...]}`` (failure payload), a plain array (success path) or a JSON
 * string of either. Returns ``null`` when the count can't be determined.
 */
export function logEntryCount(raw: unknown): number | null {
  if (raw == null) return null
  let value: unknown = raw
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        value = JSON.parse(trimmed)
      } catch {
        return null
      }
    } else {
      return null
    }
  }
  if (Array.isArray(value)) return value.length
  if (value && typeof value === 'object') {
    const inner = (value as Record<string, unknown>).logs
    if (Array.isArray(inner)) return inner.length
  }
  return null
}

const FAILURE_DETAIL_DIVIDER = '--- Technische Details ---'

/**
 * Split a task-logs string into a friendly headline + a collapsible technical
 * body. The backend's celery_event_listener emits infrastructure failures in a
 * stable two-section format separated by ``--- Technische Details ---``.
 */
export function splitTaskLogs(raw: string | Record<string, unknown> | null | undefined) {
  if (!raw) return { headline: '', details: '', isFailure: false }
  const text = String(raw)
  const dividerIdx = text.indexOf(FAILURE_DETAIL_DIVIDER)
  if (dividerIdx >= 0) {
    return {
      headline: text.slice(0, dividerIdx).trim(),
      details: text.slice(dividerIdx + FAILURE_DETAIL_DIVIDER.length).trim(),
      isFailure: true,
    }
  }
  // Legacy ``Task failed: ...\n<traceback>`` shape: first line is the headline.
  if (text.startsWith('Task failed:')) {
    const newlineIdx = text.indexOf('\n')
    if (newlineIdx > 0) {
      return {
        headline: text.slice(0, newlineIdx).trim(),
        details: text.slice(newlineIdx + 1).trim(),
        isFailure: true,
      }
    }
    return { headline: text.trim(), details: '', isFailure: true }
  }
  return { headline: '', details: '', isFailure: false }
}

export interface StatusStyles {
  label: string
  dotClass: string
  textClass: string
  badgeClass: string
  icon: LucideIcon
}

const style = (
  label: string,
  dotClass: string,
  badgeClass: string,
  icon: LucideIcon,
  textClass = 'text-gray-900',
): StatusStyles => ({ label, dotClass, textClass, badgeClass, icon })

export function getStatusStyles(status?: string): StatusStyles {
  switch (status) {
    case 'success':
      return style(
        'DeploymentsView.deploymentSuccessful',
        'bg-green-500 shadow-[0_0_10px_rgb(var(--color-status-green)/0.4)]',
        'bg-green-100 text-green-800 border-green-300',
        CheckCircle,
      )
    case 'running':
      return style(
        'DeploymentsView.deploymentRunning',
        'bg-blue-500 animate-pulse shadow-[0_0_12px_rgb(var(--color-info)/0.6)]',
        'bg-blue-100 text-blue-800 border-blue-300',
        Loader2,
      )
    case 'pending':
      return style(
        'DeploymentsView.deploymentPending',
        'bg-yellow-500 shadow-[0_0_10px_rgb(var(--color-status-yellow)/0.4)]',
        'bg-yellow-100 text-yellow-800 border-yellow-300',
        Clock,
      )
    case 'failed':
      return style(
        'DeploymentsView.deploymentFailed',
        'bg-red-500 shadow-[0_0_10px_rgb(var(--color-danger)/0.4)]',
        'bg-red-100 text-red-800 border-red-300',
        XCircle,
      )
    case 'destroying':
      return style(
        'DeploymentsView.deploymentDestroying',
        'bg-orange-500 animate-pulse shadow-[0_0_12px_rgb(var(--color-status-orange)/0.6)]',
        'bg-orange-100 text-orange-700 border-orange-300',
        Loader2,
      )
    case 'cancelled':
      return style(
        'DeploymentsView.deploymentCancelled',
        'bg-gray-400',
        'bg-gray-100 text-gray-700 border-gray-300',
        StopCircle,
      )
    case 'destroyed':
      return style(
        'DeploymentsView.deploymentDestroyed',
        'bg-orange-500 shadow-[0_0_10px_rgb(var(--color-status-orange)/0.4)]',
        'bg-orange-100 text-orange-800 border-orange-300',
        Flame,
      )
    // ``pausing``/``resuming`` borrow the "in flight" palette — the user reads
    // "something active is happening" at a glance, distinct from calm green.
    case 'pausing':
      return style(
        'DeploymentsView.deploymentPausing',
        'bg-amber-500 animate-pulse shadow-[0_0_12px_rgb(var(--color-warning)/0.6)]',
        'bg-amber-100 text-amber-800 border-amber-300',
        Loader2,
      )
    case 'paused':
      return style(
        'DeploymentsView.deploymentPaused',
        'bg-slate-400 shadow-[0_0_10px_rgb(var(--color-status-slate)/0.4)]',
        'bg-slate-100 text-slate-700 border-slate-300',
        PauseCircle,
      )
    case 'resuming':
      return style(
        'DeploymentsView.deploymentResuming',
        'bg-emerald-500 animate-pulse shadow-[0_0_12px_rgb(var(--color-success)/0.6)]',
        'bg-emerald-100 text-emerald-800 border-emerald-300',
        Loader2,
      )
    // The deployment itself is unaffected — only the pause/resume pass tripped.
    case 'pause_failed':
      return style(
        'DeploymentsView.deploymentPauseFailed',
        'bg-amber-500 shadow-[0_0_10px_rgb(var(--color-warning)/0.4)]',
        'bg-amber-100 text-amber-900 border-amber-300',
        AlertCircle,
      )
    case 'resume_failed':
      return style(
        'DeploymentsView.deploymentResumeFailed',
        'bg-amber-500 shadow-[0_0_10px_rgb(var(--color-warning)/0.4)]',
        'bg-amber-100 text-amber-900 border-amber-300',
        AlertCircle,
      )
    default:
      return style(
        'DeploymentsView.noStatus',
        'bg-gray-300',
        'bg-gray-100 text-gray-800 border-gray-300',
        AlertCircle,
        'text-gray-400',
      )
  }
}

/** Tailwind text colour of the small status icon next to a status. */
export function statusIconColor(status?: string): string {
  if (status === 'success') return 'text-green-600'
  if (status === 'failed') return 'text-red-600'
  if (status === 'running') return 'text-blue-600'
  return 'text-yellow-600'
}

function userInputObject(raw: unknown): Record<string, any> | null {
  if (!raw) return null
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, any>)
  } catch (e) {
    console.error('Error parsing userInputVar:', e)
    return null
  }
}

export interface DeploymentGroup {
  index: number
  name: string
  students: string[]
}

export function parseGroups(userInputVar: unknown): DeploymentGroup[] {
  const data = userInputObject(userInputVar)
  if (!data) return []
  const groupNames: string[] = data.groupNames || []
  const assignments: Record<string, string[]> = data.assignments || {}
  return Object.keys(assignments).map((groupIndex, idx) => ({
    index: parseInt(groupIndex),
    name: groupNames[idx] || `Gruppe ${parseInt(groupIndex) + 1}`,
    students: assignments[groupIndex] || [],
  }))
}

export function parseVariables(userInputVar: unknown): Record<string, string> {
  const data = userInputObject(userInputVar)
  return (data?.variables as Record<string, string>) || {}
}

/** Variable values may carry HCL-style trailing comments and quotes. */
export function cleanVariableValue(value?: string): string {
  const str = String(value ?? '')
  let cleaned = str.split('#')[0]?.trim() ?? ''
  cleaned = cleaned.replace(/["']/g, '')
  return cleaned.trim() || '-'
}

export function sortByCreatedDesc(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

/**
 * The "active" task is the one we still expect events from; if all are
 * terminal, the newest one (its progress columns may still be useful).
 */
export function pickActiveTask(tasks: Task[]): Task | null {
  if (!tasks.length) return null
  const sorted = sortByCreatedDesc(tasks)
  return sorted.find((t) => t.status === 'pending' || t.status === 'running') ?? sorted[0] ?? null
}

/** Whether a task status means "still moving". */
export const isLiveStatus = (status?: string | null) => status === 'pending' || status === 'running'
