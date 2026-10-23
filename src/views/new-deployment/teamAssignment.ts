/**
 * Pure, immutable logic of the wizard's team-assignment step. Nothing here
 * touches the store or React; the view feeds the result into the draft.
 */

export type GroupMode = 'one' | 'eachUser' | 'custom'

export interface TeamsState {
  mode: GroupMode
  count: number
  /** Student ids per team. */
  assignments: string[][]
  names: string[]
}

type Translate = (key: string, options: { index: number }) => string

const DEFAULT_NAME_KEY = 'deployment.assignment.vmDefaultName'
const LEGACY_DEFAULT_PREFIX = 'Team'

const defaultName = (index: number, t: Translate) => t(DEFAULT_NAME_KEY, { index: index + 1 })
const isBlank = (value: string | undefined) => !value || value.trim() === ''

/** Names for ``count`` teams: existing non-blank names are kept, the rest defaulted. */
function namesFor(count: number, existing: string[], t: Translate): string[] {
  return Array.from({ length: count }, (_, i) => (isBlank(existing[i]) ? defaultName(i, t) : existing[i]!))
}

function assignmentsFor(count: number, existing: string[][]): string[][] {
  return Array.from({ length: count }, (_, i) => existing[i] ?? [])
}

/** At least one team, and assignment/name arrays that match the team count. */
export function normalizeTeams(state: TeamsState, t: Translate): TeamsState {
  const count = Math.max(1, state.count || 1)
  return {
    ...state,
    count,
    assignments: assignmentsFor(count, state.assignments),
    names: namesFor(count, state.names, t),
  }
}

/** "One team for everyone"; keeps a custom name, replaces blank/legacy ones. */
export function chooseOneGroup(state: TeamsState, studentIds: string[], t: Translate): TeamsState {
  const first = state.names[0]
  const keep = !isBlank(first) && !first!.startsWith(LEGACY_DEFAULT_PREFIX)
  return {
    mode: 'one',
    count: 1,
    assignments: [[...studentIds]],
    names: [keep ? first! : defaultName(0, t)],
  }
}

/** One team per student (also forced for Windows apps). */
export function chooseEachUser(studentIds: string[], t: Translate): TeamsState {
  return {
    mode: 'eachUser',
    count: studentIds.length,
    assignments: studentIds.map((id) => [id]),
    names: studentIds.map((_, i) => defaultName(i, t)),
  }
}

/** Free assignment; starts with two teams when coming from a single one. */
export function chooseCustom(state: TeamsState, studentCount: number, t: Translate): TeamsState {
  const count = state.count === 1 && studentCount > 1 ? 2 : state.count
  return normalizeTeams({ ...state, mode: 'custom', count }, t)
}

/**
 * Grow or shrink the number of teams. New teams are empty and default-named;
 * students of removed teams simply become unassigned.
 */
export function resizeTeams(state: TeamsState, newCount: number, t: Translate): TeamsState {
  return {
    ...state,
    count: newCount,
    assignments: assignmentsFor(newCount, state.assignments),
    names: namesFor(newCount, state.names, t),
  }
}

const withoutStudent = (assignments: string[][], studentId: string) =>
  assignments.map((group) => (group ?? []).filter((id) => id !== studentId))

/** Move a student to team ``target`` (or to the unassigned pool for ``null``). */
export function moveStudent(assignments: string[][], studentId: string, target: number | null): string[][] {
  const next = withoutStudent(assignments, studentId)
  if (target === null) return next
  while (next.length <= target) next.push([])
  next[target] = [...next[target]!, studentId]
  return next
}

export function removeFromTeam(assignments: string[][], studentId: string, teamIndex: number): string[][] {
  return assignments.map((group, i) => (i === teamIndex ? (group ?? []).filter((id) => id !== studentId) : group))
}

/** Random, evenly sized teams (Fisher-Yates); earlier teams take the remainder. */
export function shuffleIntoTeams(studentIds: string[], count: number, random: () => number): string[][] {
  const pool = [...studentIds]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  const base = Math.floor(pool.length / count)
  const remainder = pool.length % count
  const teams: string[][] = []
  let cursor = 0
  for (let i = 0; i < count; i++) {
    const size = base + (i < remainder ? 1 : 0)
    teams.push(pool.slice(cursor, cursor + size))
    cursor += size
  }
  return teams
}

export const clearAssignments = (count: number): string[][] => Array.from({ length: count }, () => [])

export function unassignedOf(studentIds: string[], assignments: string[][]): string[] {
  const assigned = new Set(assignments.flat())
  return studentIds.filter((id) => !assigned.has(id))
}

/** Everybody assigned, no empty team, no blank team name. */
export function isAssignmentComplete(studentIds: string[], state: TeamsState): boolean {
  const teams = state.assignments.slice(0, state.count)
  const names = state.names.slice(0, state.count)
  return (
    unassignedOf(studentIds, state.assignments).length === 0 &&
    !teams.some((g) => !g || g.length === 0) &&
    !names.some((n) => isBlank(n))
  )
}
