/**
 * Pure logic of the wizard's variables step: scope/slot handling, restoring
 * form values from the draft, comparing against defaults, and required-gating.
 * The view only wires these functions to React state.
 *
 * Form values are keyed by ``formKeyOf``: the variable name, except for Packer
 * variables of multi-image apps, which are namespaced ``<template_key>.<name>``.
 */
import type { AppVariable, User } from '@/types'
import { isBool, isList, isNumber } from '@/utils/variable-types'

export type Scope = 'all' | 'team' | 'user'
export type FormValues = Record<string, any>

export interface WizardTeamMember {
  userId: string
  username: string
}

export interface WizardTeam {
  name: string
  members: WizardTeamMember[]
}

const DEFAULT_TEMPLATE_KEY = 'default'
const FALLBACK_USERNAME_LENGTH = 8

// ------------------------------------------------------------------ flags
export const isFileVar = (v: AppVariable): boolean => v.osType === 'file'

export const isExpert = (v: AppVariable): boolean => v.description?.includes('@expert') ?? false

export const displayDescription = (v: AppVariable): string =>
  (v.description ?? '').replace(/@expert\b/g, '').trim()

export const effectiveScope = (v: AppVariable): Scope => (v.varScope || v.osScope || 'all') as Scope

export const isScoped = (v: AppVariable): boolean => effectiveScope(v) !== 'all'

const isPlainObject = (x: unknown): x is Record<string, any> =>
  !!x && typeof x === 'object' && !Array.isArray(x)

const isEmptyValue = (val: unknown): boolean =>
  val === undefined ||
  val === null ||
  (typeof val === 'string' && val.trim() === '') ||
  (Array.isArray(val) && val.length === 0)

// ------------------------------------------------------------ teams & slots
/** Teams with member display names, derived from the draft and the student cache. */
export function buildWizardTeams(
  groupNames: string[],
  assignments: string[][],
  studentCache: Map<string, Partial<User>>,
): WizardTeam[] {
  return (groupNames || []).map((rawName, idx) => {
    const memberIds = (assignments?.[idx] || []).map(String)
    return {
      name: rawName || `Team-${idx + 1}`,
      members: memberIds.map((userId) => {
        const cached = studentCache.get(userId)
        const username =
          cached?.username ||
          cached?.email?.split('@')[0] ||
          cached?.firstName ||
          userId.slice(0, FALLBACK_USERNAME_LENGTH)
        return { userId, username }
      }),
    }
  })
}

export const userSlotKey = (teamName: string, username: string): string => `${teamName}-${username}`

/** Slot keys of a scoped variable: one per team, or one per team member. */
export function slotKeysFor(v: AppVariable, teams: WizardTeam[]): string[] {
  const scope = effectiveScope(v)
  if (scope === 'team') return teams.map((t) => t.name)
  if (scope === 'user') {
    return teams.flatMap((t) => t.members.map((m) => userSlotKey(t.name, m.username)))
  }
  return []
}

/** Human label of a slot. Longest team name wins so dashes in names resolve correctly. */
export function formatSlotLabel(v: AppVariable, slotKey: string, teams: WizardTeam[]): string {
  const scope = effectiveScope(v)
  if (scope === 'team') return `Team „${slotKey}"`
  if (scope === 'user') {
    const names = teams.map((t) => t.name).sort((a, b) => b.length - a.length)
    for (const team of names) {
      if (slotKey === team) return `Team „${team}"`
      if (slotKey.startsWith(team + '-')) return `Team „${team}" → ${slotKey.slice(team.length + 1)}`
    }
    const sep = slotKey.lastIndexOf('-')
    if (sep > 0) return `Team „${slotKey.slice(0, sep)}" → ${slotKey.slice(sep + 1)}`
  }
  return slotKey
}

/**
 * Initial slot map of a scoped variable: a scalar or list default is spread over
 * every slot (list defaults as comma string, like the plain textarea). Object
 * defaults yield nothing; existing values (returning via "Back") are kept.
 */
export function seedScopedDefault(
  v: AppVariable,
  existing: Record<string, any> | undefined,
  teams: WizardTeam[],
): Record<string, any> {
  const map: Record<string, any> = isPlainObject(existing) ? { ...existing } : {}
  const def = v.default
  const seedable =
    def !== undefined &&
    def !== null &&
    (typeof def === 'string' || typeof def === 'number' || typeof def === 'boolean' || Array.isArray(def))
  if (!seedable) return map

  const seed = isList(v.type) && Array.isArray(def) ? def.join(', ') : def
  for (const slot of slotKeysFor(v, teams)) {
    const current = map[slot]
    if (current === undefined || current === null || current === '') map[slot] = seed
  }
  return map
}

// ------------------------------------------------------ definitions/layout
/** Packer variables per template key (``default`` when the app has a single image). */
export function groupPackerByTemplate(defs: AppVariable[]): Record<string, AppVariable[]> {
  const out: Record<string, AppVariable[]> = {}
  for (const v of defs) {
    if (v.source !== 'packer') continue
    ;(out[v.template_key ?? DEFAULT_TEMPLATE_KEY] ??= []).push(v)
  }
  return out
}

/** Multi-image when there are several template keys, or one that isn't ``default``. */
export function isMultiImageLayout(templateKeys: string[]): boolean {
  return templateKeys.length > 1 || (templateKeys.length === 1 && templateKeys[0] !== DEFAULT_TEMPLATE_KEY)
}

export function formKeyOf(v: AppVariable, isMultiImage: boolean): string {
  if (v.source !== 'packer') return v.name
  const tkey = v.template_key ?? DEFAULT_TEMPLATE_KEY
  return !isMultiImage || tkey === DEFAULT_TEMPLATE_KEY ? v.name : `${tkey}.${v.name}`
}

/** Drops duplicate definitions (same template key + name; terraform: name). */
export function dedupeVariables(defs: AppVariable[]): AppVariable[] {
  const seen = new Map<string, AppVariable>()
  for (const v of defs) {
    const key = v.source === 'packer' ? `${v.template_key ?? DEFAULT_TEMPLATE_KEY}.${v.name}` : v.name
    if (!seen.has(key)) seen.set(key, v)
  }
  return [...seen.values()]
}

// -------------------------------------------------------------- restoring
const listAsText = (key: string, type: string, values: FormValues) => {
  if (isList(type) && Array.isArray(values[key])) values[key] = values[key].join(', ')
}

/**
 * Re-hydrate form values from ``draft.variables`` (the user came back via
 * "Back"). Packer values are stored flat for single-image and nested under
 * ``packer[<tkey>]`` for multi-image apps; missing values fall back to defaults.
 */
export function restoreFromDraft(
  defs: AppVariable[],
  stored: Record<string, any>,
  isMultiImage: boolean,
  teams: WizardTeam[],
): FormValues {
  const values: FormValues = {}
  for (const v of defs) {
    if (isFileVar(v)) continue // files travel through draft.fileUploads
    const key = formKeyOf(v, isMultiImage)

    let storedValue: any
    if (v.source === 'packer' && isMultiImage) {
      storedValue = stored.packer?.[v.template_key ?? DEFAULT_TEMPLATE_KEY]?.[v.name]
    } else if (v.source === 'packer') {
      storedValue = stored.packer?.[v.name] ?? stored[v.name]
    } else {
      storedValue = stored[v.name]
    }

    if (isScoped(v)) {
      values[key] = seedScopedDefault(v, isPlainObject(storedValue) ? storedValue : undefined, teams)
      continue
    }

    if (storedValue !== undefined && storedValue !== null) values[key] = storedValue
    else if (v.default !== undefined && v.default !== null) values[key] = v.default
    else values[key] = ''
    // The textarea widget expects a comma string for lists.
    listAsText(key, v.type, values)
  }
  return values
}

/** Initial form values after a fresh load: saved user input, then defaults. */
export function initialFromFetch(
  defs: AppVariable[],
  saved: Record<string, any>,
  isMultiImage: boolean,
  teams: WizardTeam[],
): FormValues {
  const values: FormValues = {}
  for (const v of defs) {
    const key = formKeyOf(v, isMultiImage)
    let value: any = ''
    if (saved[key] !== undefined) value = saved[key]
    else if (saved[v.name] !== undefined) value = saved[v.name]
    else if (v.default !== undefined && v.default !== null) value = v.default

    if (isScoped(v) && !isFileVar(v)) {
      values[key] = seedScopedDefault(v, isPlainObject(value) ? value : undefined, teams)
      continue
    }
    if (isList(v.type) && Array.isArray(value)) value = value.join(', ')
    if (value === '' || value === null || value === undefined) value = isBool(v.type) ? false : ''
    values[key] = value
  }
  return values
}

// --------------------------------------------------------------- comparing
/** Canonical form for "differs from default" comparisons. */
export function normalizeValue(val: any, type: string): unknown {
  if (val === null || val === undefined) {
    if (isList(type)) return []
    if (isBool(type)) return false
    return ''
  }
  if (isList(type)) {
    const arr = Array.isArray(val)
      ? val
      : typeof val === 'string'
        ? val.split(',').map((s) => s.trim()).filter((s) => s !== '')
        : [String(val)]
    return JSON.stringify([...arr].sort())
  }
  if (isNumber(type)) return val === '' ? null : Number(val)
  if (isBool(type)) return Boolean(val)
  return String(val).trim()
}

const splitList = (raw: string) => raw.split(',').map((s) => s.trim()).filter((s) => s !== '')

/** Value as it is stored in the draft: lists as arrays, numbers as numbers. */
function toStoredValue(raw: any, type: string): any {
  if (isList(type) && typeof raw === 'string') return splitList(raw)
  if (isNumber(type) && raw !== '') return Number(raw)
  return raw
}

function cleanScopedMap(map: unknown, type: string): Record<string, any> {
  const clean: Record<string, any> = {}
  if (!isPlainObject(map)) return clean
  for (const [slot, raw] of Object.entries(map)) {
    if (raw === undefined || raw === null) continue
    if (typeof raw === 'string' && raw.trim() === '') continue
    clean[slot] = toStoredValue(raw, type)
  }
  return clean
}

/**
 * Splits the form into ``changed`` (differs from the author default; becomes
 * ``userInputVar``) and ``all`` (becomes ``draft.variables``). Multi-image
 * Packer values are nested under ``packer[<tkey>]``.
 */
export function buildDraftValues(
  defs: AppVariable[],
  form: FormValues,
  isMultiImage: boolean,
): { changed: Record<string, any>; all: Record<string, any> } {
  const changed: Record<string, any> = {}
  const all: Record<string, any> = {}
  const nestedChanged: Record<string, Record<string, any>> = {}
  const nestedAll: Record<string, Record<string, any>> = {}

  for (const v of defs) {
    if (isFileVar(v)) continue
    const key = formKeyOf(v, isMultiImage)
    const tkey = v.template_key ?? DEFAULT_TEMPLATE_KEY
    const nested = v.source === 'packer' && isMultiImage

    let value: any
    let hasChanged: boolean
    if (isScoped(v)) {
      value = cleanScopedMap(form[key], v.type)
      hasChanged = Object.keys(value).length > 0
    } else {
      value = toStoredValue(form[key], v.type)
      hasChanged = normalizeValue(form[key], v.type) !== normalizeValue(v.default, v.type)
    }

    if (nested) {
      if (hasChanged) (nestedChanged[tkey] ??= {})[v.name] = value
      ;(nestedAll[tkey] ??= {})[v.name] = value
    } else {
      if (hasChanged) changed[v.name] = value
      all[v.name] = value
    }
  }

  if (isMultiImage && Object.keys(nestedChanged).length > 0) changed.packer = nestedChanged
  if (isMultiImage && Object.keys(nestedAll).length > 0) all.packer = nestedAll
  return { changed, all }
}

// ------------------------------------------------------- required gating
/** Names of required variables (or ``name (slot)``) that are still empty. */
export function findMissingRequired(
  defs: AppVariable[],
  form: FormValues,
  isMultiImage: boolean,
  teams: WizardTeam[],
): string[] {
  const missing: string[] = []
  for (const v of defs) {
    if (!v.required || isFileVar(v)) continue
    const key = formKeyOf(v, isMultiImage)
    if (isScoped(v)) {
      const map = (form[key] ?? {}) as Record<string, any>
      const slots = slotKeysFor(v, teams)
      if (slots.length === 0) missing.push(v.name)
      for (const slot of slots) if (isEmptyValue(map[slot])) missing.push(`${v.name} (${slot})`)
    } else if (isEmptyValue(form[key])) {
      missing.push(v.name)
    }
  }
  return missing
}

/** Removes slot values whose team/user no longer exists (e.g. after a rename). */
export function dropStaleSlots(
  defs: AppVariable[],
  form: FormValues,
  isMultiImage: boolean,
  teams: WizardTeam[],
): { values: FormValues; dropped: string[] } {
  const dropped: string[] = []
  let values = form
  for (const v of defs) {
    if (!isScoped(v) || isFileVar(v)) continue
    const key = formKeyOf(v, isMultiImage)
    const map = form[key]
    if (!isPlainObject(map)) continue
    const valid = new Set(slotKeysFor(v, teams))
    const stale = Object.keys(map).filter((slot) => !valid.has(slot))
    if (stale.length === 0) continue
    stale.forEach((slot) => dropped.push(`${v.name} → ${slot}`))
    const kept = Object.fromEntries(Object.entries(map).filter(([slot]) => valid.has(slot)))
    values = { ...values, [key]: kept }
  }
  return { values, dropped }
}

/** Expert sections open by default when a required expert variable has no default. */
export const hasBlockingExpert = (defs: AppVariable[]): boolean =>
  defs.some((v) => isExpert(v) && v.required && (v.default === null || v.default === undefined))
