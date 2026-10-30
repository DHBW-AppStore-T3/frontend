/**
 * What the summary step lists under "Variablen-Konfiguration": one row per thing the app lets
 * people set (resources, network, files, values). No rows means no card; step 3 and this card
 * are two views of the same question, see ``needsVariablesStep``.
 *
 * The rows hold data (numbers, names, sizes), not sentences: the components turn them into text in
 * the language of the page. Files are described by name and size, never by content.
 */
import type { AppVariable, DeploymentDraft, DeploymentFile } from '@/types'
import { networkValue, visibleNetworkKeys } from '@/utils/network'
import { formatMemoryGb, isDefaultSelection, totalResources } from '@/utils/resources'
import { humanizeName } from './fileLimits'
import { buildRecipients, sameFile } from './recipientRows'
import { formatValue, type SummaryContext } from './summary'
import { isExpert, type WizardTeam } from './variableForm'

export interface SettingsContext extends SummaryContext {
  /** The teams of the draft, named as in the wizard. */
  teams: WizardTeam[]
  nameOf: (userId: string) => string
}

/** What one environment is: a pod, or a Windows desktop. */
export type EnvironmentUnit = 'pod' | 'desktop'

export interface FileInfo {
  name: string
  size: number
}

export interface ResourcesRow {
  kind: 'resources'
  id: string
  label: string
  unit: EnvironmentUnit
  /** vCPU of one environment (all its containers together). */
  cpu: number
  /** RAM of one environment in GB. */
  memoryGb: string
  /** Differs from the recommendation of the app. */
  changed: boolean
  /** What all people together get; only when every person has an environment of their own. */
  total: { people: number; cpu: number; memoryGb: string } | null
}

export interface NetworkRow {
  kind: 'network'
  id: string
  label: string
  key: 'internet' | 'podNetwork'
  on: boolean
  unit: EnvironmentUnit
}

export interface FileRecipient {
  id: string
  name: string
  sub?: string
  file: FileInfo | null
}

export type FileRow = {
  kind: 'file'
  id: string
  label: string
} & (
  | { state: 'none' }
  /** One file for all ``people`` people. */
  | { state: 'uniform'; file: FileInfo; people: number }
  /** Different files, or files for some only: ``count`` files, ``bytes`` together, and who got which. */
  | { state: 'each'; count: number; bytes: number; recipients: FileRecipient[] }
)

export interface ValueLine {
  /** The team or person this value is for; ``null`` for a value that is the same for everybody. */
  slot: string | null
  text: string
}

export interface ValueRow {
  kind: 'value'
  id: string
  label: string
  lines: ValueLine[]
}

export type SettingsRow = ResourcesRow | NetworkRow | FileRow | ValueRow

const EMPTY = '-'

const unitOf = (draft: DeploymentDraft): EnvironmentUnit => (draft.runtime === 'kubevirt-vm' ? 'desktop' : 'pod')

/** A readable title: the label the app sends, else one made from the name. */
const titleOf = (def: AppVariable): string => def.label ?? humanizeName(def.name)

function resourcesRow(draft: DeploymentDraft, ctx: SettingsContext): ResourcesRow | null {
  const choices = draft.resourceChoices ?? []
  if (choices.length === 0) return null
  const selection = draft.resources ?? {}
  const sum = totalResources(choices, selection)
  const people = draft.studentIds.length
  return {
    kind: 'resources',
    id: 'resources',
    label: ctx.t('deployment.resources.title'),
    unit: unitOf(draft),
    cpu: sum.cpuMillicores / 1000,
    memoryGb: formatMemoryGb(sum.memoryMib),
    changed: !isDefaultSelection(choices, selection),
    // Only when several people each have an environment: for one person the sum is the row itself.
    total:
      draft.scope === 'user' && people > 1
        ? { people, cpu: (sum.cpuMillicores * people) / 1000, memoryGb: formatMemoryGb(sum.memoryMib * people) }
        : null,
  }
}

/** What one environment is, where the person chose it (one per person or per group). */
function scopeRows(draft: DeploymentDraft, ctx: SettingsContext): ValueRow[] {
  if (!draft.scopeChoice) return []
  const scope = draft.scope === 'team' ? 'team' : 'user'
  return [
    {
      kind: 'value',
      id: 'scope',
      label: ctx.t('deployment.assignment.scopeChoice.title'),
      lines: [{ slot: null, text: ctx.t(`deployment.assignment.scopeChoice.${scope}.label`) }],
    },
  ]
}

function networkRows(draft: DeploymentDraft, ctx: SettingsContext): NetworkRow[] {
  const unit = unitOf(draft)
  return visibleNetworkKeys(draft).map((key) => ({
    kind: 'network',
    id: `network-${key}`,
    label: ctx.t(key === 'podNetwork' && unit === 'desktop' ? 'deployment.vm.pods.label' : `deployment.network.${key}.label`),
    key,
    on: networkValue(draft, key),
    unit,
  }))
}

const infoOf = (file: DeploymentFile): FileInfo => ({ name: file.name, size: file.size })

function fileRow(def: AppVariable, draft: DeploymentDraft, ctx: SettingsContext): FileRow {
  const base = { kind: 'file', id: `file-${def.name}`, label: titleOf(def) } as const
  const { rows } = buildRecipients(def, ctx.teams, ctx.nameOf)
  const slots: Record<string, DeploymentFile | null | undefined> = draft.fileUploads?.[def.name] ?? {}
  const entries = rows.map((row) => ({ row, file: slots[row.id] ?? null }))
  const filled = entries.filter((e) => e.file)
  if (filled.length === 0) return { ...base, state: 'none' }

  const first = filled[0]!.file!
  // The same rule as the file card of step 3: everybody has the same file.
  if (filled.length === entries.length && filled.every((e) => sameFile(e.file, first))) {
    return { ...base, state: 'uniform', file: infoOf(first), people: draft.studentIds.length }
  }
  return {
    ...base,
    state: 'each',
    count: filled.length,
    bytes: filled.reduce((sum, e) => sum + e.file!.size, 0),
    recipients: entries.map(({ row, file }) => ({
      id: row.id,
      name: row.name,
      ...(row.sub ? { sub: row.sub } : {}),
      file: file ? infoOf(file) : null,
    })),
  }
}

function valueRow(def: AppVariable, draft: DeploymentDraft, ctx: SettingsContext): ValueRow {
  const current = draft.variables ?? {}
  const val = current[def.name] !== undefined ? current[def.name] : def.default
  const base = { kind: 'value', id: `value-${def.name}`, label: titleOf(def) } as const

  if (def.varScope === 'team' || def.varScope === 'user') {
    const entries = val && typeof val === 'object' && !Array.isArray(val) ? Object.entries(val as Record<string, unknown>) : []
    if (entries.length === 0) return { ...base, lines: [{ slot: null, text: EMPTY }] }
    return { ...base, lines: entries.map(([slot, raw]) => ({ slot, text: formatValue(raw, ctx.t) })) }
  }
  return { ...base, lines: [{ slot: null, text: formatValue(val, ctx.t) }] }
}

/** The rows of the card "Variablen-Konfiguration", in the order resources, networks, files, values. */
export function buildSettingsRows(draft: DeploymentDraft, defs: AppVariable[], ctx: SettingsContext): SettingsRow[] {
  const resources = resourcesRow(draft, ctx)
  return [
    ...scopeRows(draft, ctx),
    ...(resources ? [resources] : []),
    ...networkRows(draft, ctx),
    // Files marked @expert are not offered by the wizard, so they are not listed either.
    ...defs.filter((d) => d.osType === 'file' && !isExpert(d)).map((d) => fileRow(d, draft, ctx)),
    // A file variable has a renderer of its own: its ``default = {}`` is not the upload.
    ...defs.filter((d) => d.source === 'terraform' && d.osType !== 'file').map((d) => valueRow(d, draft, ctx)),
  ]
}
