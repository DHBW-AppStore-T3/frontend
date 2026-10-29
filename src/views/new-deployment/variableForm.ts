/**
 * Pure logic of the wizard's variables step: scope/slot handling, restoring
 * form values from the draft, comparing against defaults, and required-gating.
 * The view only wires these functions to React state.
 *
 * Form values are keyed by ``formKeyOf``, i.e. the variable name.
 */
import type {
  AppVariable,
  DeploymentFile,
  ScalarValue,
  SlotMap,
  SlotValue,
  StoredValue,
  StoredValues,
  User,
  VariableValue,
} from '@/types'
import { isBool, isList, isNumber } from '@/utils/variable-types'

export type Scope = 'all' | 'team' | 'user'

// ------------------------------------------------------------------ values
// The value types live in ``@/types`` because ``DeploymentDraft`` is built from them;
// they are re-exported here, where the form logic uses them.
export type { ScalarValue, SlotMap, SlotValue, StoredValue, StoredValues, VariableValue }

/**
 * What the form holds per variable, keyed by ``formKeyOf``: a scalar, a map for
 * map-typed variables, a ``SlotMap`` for scoped ones, and for list variables the
 * comma-separated TEXT the textarea shows (``restoreFromDraft`` and
 * ``initialFromFetch`` join arrays; an array can still survive inside a slot).
 * Like a slot it is not validated, so null and undefined are possible.
 */
export type FormValues = Record<string, SlotValue>

export interface WizardTeamMember {
  userId: string
  username: string
}

export interface WizardTeam {
  name: string
  members: WizardTeamMember[]
}

const FALLBACK_USERNAME_LENGTH = 8

// ------------------------------------------------------------------ flags
export const isFileVar = (v: AppVariable): boolean => v.osType === 'file'

export const isExpert = (v: AppVariable): boolean => v.description?.includes('@expert') ?? false

export const displayDescription = (v: AppVariable): string =>
  (v.description ?? '').replace(/@expert\b/g, '').trim()

export const effectiveScope = (v: AppVariable): Scope => (v.varScope || v.osScope || 'all') as Scope

export const isScoped = (v: AppVariable): boolean => effectiveScope(v) !== 'all'

/**
 * ``true`` for an object that is not an array: the only test the slot maps get, as
 * before. The entries are not checked.
 */
export const isSlotMap = (x: unknown): x is SlotMap => !!x && typeof x === 'object' && !Array.isArray(x)

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

/**
 * Keys under which a file variable may hold files: ``all`` for one file for the whole deployment,
 * otherwise the slots of a plain variable. These are the ids of the rows of the file card
 * (``buildRecipients``).
 */
export const fileSlotKeysFor = (v: AppVariable, teams: WizardTeam[]): string[] =>
  effectiveScope(v) === 'all' ? ['all'] : slotKeysFor(v, teams)

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
  existing: SlotMap | undefined,
  teams: WizardTeam[],
): SlotMap {
  const map: SlotMap = isSlotMap(existing) ? { ...existing } : {}
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

/**
 * Reads a saved ``userInputVar`` (the draft keeps it as a JSON string, or as an
 * object once parsed). Text that is empty or not an object/JSON text gives ``{}``;
 * broken JSON also calls ``onInvalid``. The parsed JSON is not validated, as before,
 * so a JSON text like ``null`` or ``5`` comes back as it is.
 */
export function parseStoredInput(raw: unknown, onInvalid: () => void): StoredValues {
  if (isSlotMap(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    try {
      const parsed: StoredValues = JSON.parse(raw)
      return parsed
    } catch (e) {
      console.warn('Invalid JSON in userInputVar', e)
      onInvalid()
    }
  }
  return {}
}

// ------------------------------------------------------ definitions/layout
export function formKeyOf(v: AppVariable): string {
  return v.name
}

/** Drops duplicate definitions (same name). */
export function dedupeVariables(defs: AppVariable[]): AppVariable[] {
  const seen = new Map<string, AppVariable>()
  for (const v of defs) {
    if (!seen.has(v.name)) seen.set(v.name, v)
  }
  return [...seen.values()]
}

// -------------------------------------------------------------- restoring
const listAsText = (key: string, type: string, values: FormValues) => {
  const current = values[key]
  if (isList(type) && Array.isArray(current)) values[key] = current.join(', ')
}

/**
 * Re-hydrate form values from ``draft.variables`` (the user came back via
 * "Back"); missing values fall back to defaults.
 */
export function restoreFromDraft(
  defs: AppVariable[],
  stored: Record<string, StoredValue>,
  teams: WizardTeam[],
): FormValues {
  const values: FormValues = {}
  for (const v of defs) {
    if (isFileVar(v)) continue // files travel through draft.fileUploads
    const key = formKeyOf(v)

    const storedValue = stored[v.name]

    if (isScoped(v)) {
      values[key] = seedScopedDefault(v, isSlotMap(storedValue) ? storedValue : undefined, teams)
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
  saved: Record<string, StoredValue>,
  teams: WizardTeam[],
): FormValues {
  const values: FormValues = {}
  for (const v of defs) {
    const key = formKeyOf(v)
    let value: StoredValue = ''
    if (saved[key] !== undefined) value = saved[key]
    else if (saved[v.name] !== undefined) value = saved[v.name]
    else if (v.default !== undefined && v.default !== null) value = v.default

    if (isScoped(v) && !isFileVar(v)) {
      values[key] = seedScopedDefault(v, isSlotMap(value) ? value : undefined, teams)
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
export function normalizeValue(val: unknown, type: string): string | number | boolean | null | unknown[] {
  if (val === null || val === undefined) {
    if (isList(type)) return []
    if (isBool(type)) return false
    return ''
  }
  if (isList(type)) {
    const arr: unknown[] = Array.isArray(val)
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
function toStoredValue(raw: StoredValue, type: string): StoredValue {
  if (isList(type) && typeof raw === 'string') return splitList(raw)
  if (isNumber(type) && raw !== '') return Number(raw)
  return raw
}

function cleanScopedMap(map: unknown, type: string): SlotMap {
  const clean: SlotMap = {}
  if (!isSlotMap(map)) return clean
  for (const [slot, raw] of Object.entries(map)) {
    if (raw === undefined || raw === null) continue
    if (typeof raw === 'string' && raw.trim() === '') continue
    clean[slot] = toStoredValue(raw, type)
  }
  return clean
}

/**
 * Splits the form into ``changed`` (differs from the author default; becomes
 * ``userInputVar``) and ``all`` (becomes ``draft.variables``).
 */
export function buildDraftValues(
  defs: AppVariable[],
  form: FormValues,
): { changed: StoredValues; all: StoredValues } {
  const changed: StoredValues = {}
  const all: StoredValues = {}

  for (const v of defs) {
    if (isFileVar(v)) continue
    const key = formKeyOf(v)

    let value: StoredValue
    let hasChanged: boolean
    if (isScoped(v)) {
      value = cleanScopedMap(form[key], v.type)
      hasChanged = Object.keys(value).length > 0
    } else {
      value = toStoredValue(form[key], v.type)
      hasChanged = normalizeValue(form[key], v.type) !== normalizeValue(v.default, v.type)
    }

    if (hasChanged) changed[v.name] = value
    all[v.name] = value
  }
  return { changed, all }
}

// ------------------------------------------------------- required gating
/** Names of required variables (or ``name (slot)``) that are still empty. */
export function findMissingRequired(
  defs: AppVariable[],
  form: Record<string, unknown>,
  teams: WizardTeam[],
): string[] {
  const missing: string[] = []
  for (const v of defs) {
    if (!v.required || isFileVar(v)) continue
    const key = formKeyOf(v)
    if (isScoped(v)) {
      // A value that is no map (or missing) reads every slot as undefined, as before.
      const map = (form[key] ?? {}) as SlotMap
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
  teams: WizardTeam[],
): { values: FormValues; dropped: string[] } {
  const dropped: string[] = []
  let values = form
  for (const v of defs) {
    if (!isScoped(v) || isFileVar(v)) continue
    const key = formKeyOf(v)
    const map = form[key]
    if (!isSlotMap(map)) continue
    const valid = new Set(slotKeysFor(v, teams))
    const stale = Object.keys(map).filter((slot) => !valid.has(slot))
    if (stale.length === 0) continue
    stale.forEach((slot) => dropped.push(`${v.name} → ${slot}`))
    const kept = Object.fromEntries(Object.entries(map).filter(([slot]) => valid.has(slot)))
    values = { ...values, [key]: kept }
  }
  return { values, dropped }
}

/**
 * Removes the files of slots whose team/user no longer exists, as ``dropStaleSlots`` does for
 * the values. Only the file variables of ``defs`` are looked at; the map of a variable stays (empty)
 * when its last file goes.
 */
export function dropStaleFileSlots(
  defs: AppVariable[],
  uploads: Record<string, Record<string, DeploymentFile>> | undefined,
  teams: WizardTeam[],
): { uploads: Record<string, Record<string, DeploymentFile>> | undefined; dropped: string[] } {
  const dropped: string[] = []
  let result = uploads
  for (const v of defs) {
    if (!isFileVar(v)) continue
    const files = uploads?.[v.name]
    if (!isSlotMap(files)) continue
    const valid = new Set(fileSlotKeysFor(v, teams))
    const stale = Object.keys(files).filter((slot) => !valid.has(slot))
    if (stale.length === 0) continue
    stale.forEach((slot) => dropped.push(`${v.name} → ${slot}`))
    const kept = Object.fromEntries(Object.entries(files).filter(([slot]) => valid.has(slot)))
    result = { ...result, [v.name]: kept }
  }
  return { uploads: result, dropped }
}

/** Expert sections open by default when a required expert variable has no default. */
export const hasBlockingExpert = (defs: AppVariable[]): boolean =>
  defs.some((v) => isExpert(v) && v.required && (v.default === null || v.default === undefined))
