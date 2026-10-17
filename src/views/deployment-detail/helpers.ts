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

// Structure of a single account.
export interface UserAccount {
  username: string
  team: string
  ip: string
  port: number
  auth: string
  type?: 'password' | 'ssh_key' | 'oauth' | 'none' | string
  authtype?: 'ssh' | 'url' | 'rdp' | string
  url?: string
}

export interface TeamVm {
  url?: string
  floating_ip?: string
  fixed_ip?: string
}

export type UserAccountMap = Record<string, UserAccount>
export type TeamVmMap = Record<string, TeamVm>

export interface AccountHit {
  key: string
  data: UserAccount
}

/**
 * Outputs may arrive as a raw JSON string from the DB text column or as an
 * already-parsed object. Returns the object, or ``undefined`` when it cannot
 * be interpreted (not JSON / not an object).
 */
function outputsObject(raw: unknown): Record<string, any> | undefined {
  if (raw && typeof raw === 'object') return raw as Record<string, any>
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed.startsWith('{')) return undefined
    try {
      return JSON.parse(trimmed) as Record<string, any>
    } catch {
      return undefined
    }
  }
  return undefined
}

/**
 * ``user_accounts`` out of the active task's outputs (the map sits under
 * ``.value`` because Terraform stamps the output shape on the wrapper).
 * Non-owners have no outputs, so ``fallback`` (from ``/my-access``) is used
 * whenever anything along the way is missing.
 */
export function extractUserAccounts(
  rawOutputs: unknown,
  fallback: UserAccountMap | null,
): UserAccountMap | null {
  if (!rawOutputs) return fallback
  const obj = outputsObject(rawOutputs)
  const container = obj?.user_accounts
  if (container && container.value) return container.value as UserAccountMap
  return fallback
}

/** ``team_vms`` out of the outputs, same unwrap chain as ``extractUserAccounts``. */
export function extractTeamVms(rawOutputs: unknown, fallback: TeamVmMap | null): TeamVmMap | null {
  if (!rawOutputs) return fallback
  const vms = outputsObject(rawOutputs)?.team_vms?.value
  return vms && typeof vms === 'object' ? (vms as TeamVmMap) : fallback
}

// Mirror the terraform key sanitisation: lowercase the local-part and replace
// dots with dashes. Only dots — terraform's ``replace(local_part, ".", "-")``
// does not touch other characters.
function deriveExpectedKey(teamName: string, email: string | undefined): string | null {
  if (!email) return null
  const localPart = email.split('@')[0]
  if (!localPart) return null
  const sanitised = localPart.replace(/\./g, '-').toLowerCase()
  return `${teamName.trim().toLowerCase()}-${sanitised}`
}

/**
 * Resolve member ↔ account.
 *
 * The canonical contract is the ``user_accounts`` MAP KEY, which every app
 * template constructs the same way: ``"<team>-" + email.split("@")[0].replace(".", "-")``.
 * The value's ``username`` field is not a reliable identifier (some templates
 * write the email local-part, others a shared pseudo-email), so we index by key
 * and look up the derived key per member. Three fallbacks cover other templates.
 */
export function enrichTeams(
  teams: DeploymentTeam[] | undefined,
  accounts: UserAccountMap | null,
  teamVms: TeamVmMap | null,
) {
  if (!teams) return []

  const accountByEmail = new Map<string, AccountHit>()
  const accountByUsername = new Map<string, AccountHit>()
  const accountByKey = new Map<string, AccountHit>()
  if (accounts) {
    for (const [key, acc] of Object.entries(accounts)) {
      const candidate = acc?.username?.trim().toLowerCase()
      if (candidate && candidate.includes('@')) {
        accountByEmail.set(candidate, { key, data: acc })
      } else if (candidate) {
        accountByUsername.set(candidate, { key, data: acc })
      }
      accountByKey.set(key.trim().toLowerCase(), { key, data: acc })
    }
  }

  return teams.map((team) => {
    const vm = teamVms?.[team.name] ?? null
    const teamNameLower = team.name.trim().toLowerCase()
    return {
      ...team,
      vm,
      members: team.members.map((member) => {
        const memberEmail = member?.email?.trim().toLowerCase()
        const memberName = member?.username?.trim().toLowerCase()

        // Strategy 0 (canonical): derive the terraform key from member.email + team.name.
        let hit: AccountHit | undefined
        const expectedKey = deriveExpectedKey(team.name, memberEmail)
        if (expectedKey) hit = accountByKey.get(expectedKey)

        // Strategy 1: email-based (templates that write the member's email into ``account.username``).
        if (!hit && memberEmail) hit = accountByEmail.get(memberEmail)

        // Strategy 2: username substring against account.username.
        if (!hit && memberName) {
          for (const [accUser, entry] of accountByUsername) {
            if (accUser.includes(memberName) || memberName.includes(accUser)) {
              hit = entry
              break
            }
          }
        }

        // Strategy 3: username substring against the account key (last resort).
        if (!hit && memberName) {
          for (const [accKey, entry] of accountByKey) {
            if (accKey.includes(memberName)) {
              hit = entry
              break
            }
          }
        }

        // Team scope guard so an account from team A can't be attached to a member of team B.
        const accountTeam = hit?.data.team?.trim().toLowerCase()
        const keyLower = hit?.key.trim().toLowerCase()
        const teamMatches =
          hit &&
          (accountTeam === teamNameLower ||
            (keyLower?.startsWith(`${teamNameLower}-`) ?? false) ||
            (keyLower?.includes(teamNameLower) ?? false))
        return { ...member, account: teamMatches ? hit! : null }
      }),
    }
  })
}

/** Counts the resources in a terraform state (object or JSON string). */
export function countTfResources(state: unknown): number {
  if (!state) return 0
  try {
    const parsed = typeof state === 'string' ? JSON.parse(state) : (state as any)
    return parsed?.resources?.length || 0
  } catch {
    return 0
  }
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
