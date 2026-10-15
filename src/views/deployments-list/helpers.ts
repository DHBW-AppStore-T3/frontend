import type { Deployment } from '@/types'

export const STATUS_GROUPS: Record<string, string[]> = {
  active: ['success'],
  building: ['pending', 'running', 'resuming', 'destroying', 'pausing'],
  stopped: ['paused', 'failed', 'cancelled', 'destroyed', 'pause_failed', 'resume_failed'],
}

const ALL_GROUP = 'all'

function timestampOf(item: Deployment): number {
  return item.created_at ? new Date(item.created_at).getTime() : 0
}

/**
 * The server returns the list in DB insert order, so it is sorted client-side
 * by ``created_at`` descending. Items without a timestamp fall to the end
 * (better than ``NaN`` in the comparison).
 */
export function sortNewestFirst(deployments: Deployment[]): Deployment[] {
  return [...deployments].sort((a, b) => timestampOf(b) - timestampOf(a))
}

export function filterByGroup(deployments: Deployment[], group: string): Deployment[] {
  if (group === ALL_GROUP) return deployments
  const statuses = STATUS_GROUPS[group] ?? []
  return deployments.filter((d) => statuses.includes(d.status))
}

export function countByGroup(deployments: Deployment[]) {
  return [
    ...Object.keys(STATUS_GROUPS).map((key) => ({ key, count: filterByGroup(deployments, key).length })),
    { key: ALL_GROUP, count: deployments.length },
  ]
}

// Status pills. Colour semantics: orange = destroy, amber = lifecycle-pending, slate = paused.
const STATUS_PILL_CLASS: Record<string, string> = {
  success: 'bg-successTint text-green-800 border-green-300',
  failed: 'bg-dangerTint text-red-800 border-red-300',
  running: 'bg-infoTint text-blue-800 border-blue-300',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  cancelled: 'bg-surfaceMuted text-textMuted border-borderSubtle',
  destroyed: 'bg-orange-100 text-orange-800 border-orange-300',
  destroying: 'bg-orange-100 text-orange-700 border-orange-300',
  pausing: 'bg-amber-100 text-amber-800 border-amber-300',
  paused: 'bg-slate-100 text-slate-700 border-slate-300',
  resuming: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  pause_failed: 'bg-amber-100 text-amber-900 border-amber-300',
  resume_failed: 'bg-amber-100 text-amber-900 border-amber-300',
}

const DEFAULT_STATUS_PILL_CLASS = 'bg-surfaceMuted text-textHeading border-borderSubtle'

export function statusPillClass(status: string): string {
  return STATUS_PILL_CLASS[status] ?? DEFAULT_STATUS_PILL_CLASS
}
