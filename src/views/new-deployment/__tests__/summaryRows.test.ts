import { describe, it, expect, beforeEach } from 'vitest'
import { useDeploymentStore } from '@/stores/deployment.store'
import { needsVariablesStep } from '../variablesStep'
import { buildWizardTeams } from '../variableForm'
import { buildSettingsRows, type FileRow, type SettingsContext, type SettingsRow } from '../summaryRows'
import type { AppVariable, DeploymentDraft, DeploymentFile } from '@/types'

const t = (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key)

const NAMES: Record<string, string> = { u1: 'Studentin Drei', u2: 'Student Zwei', u3: 'Student Vier' }
const nameOf = (id: string) => NAMES[id] ?? id

const vmChoice = {
  container: 'vm',
  cpu: { default: '4', min: '2', max: '8' },
  memory: { default: '8Gi', min: '4Gi', max: '16Gi' },
}

const fileVar = (over: Partial<AppVariable> = {}): AppVariable =>
  ({ name: 'starter', type: 'string', source: 'terraform', osType: 'file', osScope: 'team', ...over }) as AppVariable
const textVar = (over: Partial<AppVariable> = {}): AppVariable =>
  ({ name: 'region', type: 'string', source: 'terraform', default: 'eu-central', ...over }) as AppVariable

const zip = (name = 'starter.zip', size = 640 * 1024): DeploymentFile => ({
  name,
  size,
  content_b64: 'SECRET',
  content_type: 'application/zip',
})

/** Three people, one team each (what "Jeder Nutzer einzeln" and per-person apps produce). */
const EACH_USER = {
  groupMode: 'eachUser',
  groupCount: 3,
  groupNames: ['Team #1', 'Team #2', 'Team #3'],
  assignments: [['u1'], ['u2'], ['u3']],
}

function draftOf(over: Partial<DeploymentDraft> = {}): DeploymentDraft {
  const store = useDeploymentStore.getState()
  store.resetDraft()
  store.updateDraft({
    appId: 'app-1',
    runtime: 'kubernetes',
    scope: 'team',
    studentIds: ['u1', 'u2', 'u3'],
    ...EACH_USER,
    variableDefinitions: [],
    resourceChoices: [],
    resources: {},
    networkChoices: {},
    network: {},
    ...over,
  } as never)
  return useDeploymentStore.getState().draft
}

function rowsOf(draft: DeploymentDraft, defs: AppVariable[] = draft.variableDefinitions ?? []): SettingsRow[] {
  const teams = buildWizardTeams(draft.groupNames, draft.assignments as string[][], new Map())
  const ctx: SettingsContext = { t, teams, nameOf }
  return buildSettingsRows(draft, defs, ctx)
}

const kinds = (rows: SettingsRow[]) => rows.map((r) => (r.kind === 'network' ? `network:${r.key}` : r.kind))

beforeEach(() => {
  draftOf()
})

describe('buildSettingsRows: apps with nothing to set (type A)', () => {
  it('gives no rows, so the card "Variablen-Konfiguration" is not shown', () => {
    expect(rowsOf(draftOf())).toEqual([])
  })

  it('gives no network or resource row for a pod app that offers no choices', () => {
    expect(rowsOf(draftOf({ runtime: 'kubernetes', resourceChoices: [], networkChoices: {} }))).toEqual([])
  })

  it('gives no row for a file variable marked @expert (the wizard does not offer it)', () => {
    const defs = [fileVar({ description: 'only for pros @expert' })]
    expect(rowsOf(draftOf({ variableDefinitions: defs }), defs)).toEqual([])
  })

  it('ignores variables that are not terraform variables', () => {
    const defs = [textVar({ source: 'packer' }), textVar({ name: 'x', source: 'unknown' })]
    expect(rowsOf(draftOf({ variableDefinitions: defs }), defs)).toEqual([])
  })
})

describe('buildSettingsRows: file variable (type B)', () => {
  const defs = [fileVar({ label: 'Starter-Projekt' })]

  it('shows a row even when no file was chosen: the app offers the variable', () => {
    const [row] = rowsOf(draftOf({ variableDefinitions: defs, fileUploads: {} }), defs)
    expect(row).toMatchObject({ kind: 'file', label: 'Starter-Projekt', state: 'none' })
  })

  it('titles the row from the name when the app sends no label', () => {
    const noLabel = [fileVar({ name: 'my_starter-files' })]
    const [row] = rowsOf(draftOf({ variableDefinitions: noLabel }), noLabel)
    expect(row!.label).toBe('My starter files')
  })

  it('names one file for everybody, with the number of people it applies to', () => {
    const upload = { starter: { 'Team #1': zip(), 'Team #2': zip(), 'Team #3': zip() } }
    const [row] = rowsOf(draftOf({ variableDefinitions: defs, fileUploads: upload }), defs)
    expect(row).toMatchObject({ kind: 'file', state: 'uniform', people: 3, file: { name: 'starter.zip', size: 640 * 1024 } })
  })

  it('treats the single slot of a variable for everybody as one file for everybody', () => {
    const all = [fileVar({ osScope: 'all' })]
    const [row] = rowsOf(draftOf({ variableDefinitions: all, fileUploads: { starter: { all: zip() } } }), all)
    expect(row).toMatchObject({ state: 'uniform', people: 3 })
  })

  it('counts files and their size when people get different files, and lists who got which', () => {
    const upload = { starter: { 'Team #1': zip('a.zip', 1024), 'Team #2': zip('b.zip', 2048), 'Team #3': zip('a.zip', 1024) } }
    const [row] = rowsOf(draftOf({ variableDefinitions: defs, fileUploads: upload }), defs)
    expect(row).toMatchObject({ kind: 'file', state: 'each', count: 3, bytes: 4096 })
    expect(row).toMatchObject({
      recipients: [
        { name: 'Studentin Drei', file: { name: 'a.zip', size: 1024 } },
        { name: 'Student Zwei', file: { name: 'b.zip', size: 2048 } },
        { name: 'Student Vier', file: { name: 'a.zip', size: 1024 } },
      ],
    })
  })

  it('is "each" too when only some people got a file, and shows who got none', () => {
    const upload = { starter: { 'Team #1': zip('a.zip', 1024), 'Team #2': null } }
    const [row] = rowsOf(draftOf({ variableDefinitions: defs, fileUploads: upload as never }), defs)
    expect(row).toMatchObject({ state: 'each', count: 1, bytes: 1024 })
    expect((row as Extract<FileRow, { state: 'each' }>).recipients.map((r) => r.file?.name ?? null)).toEqual(['a.zip', null, null])
  })

  it('never carries the content of a file', () => {
    const upload = { starter: { 'Team #1': zip(), 'Team #2': zip(), 'Team #3': zip() } }
    expect(JSON.stringify(rowsOf(draftOf({ variableDefinitions: defs, fileUploads: upload }), defs))).not.toContain('SECRET')
  })
})

describe('buildSettingsRows: Windows VM (type C)', () => {
  const vm = (over: Partial<DeploymentDraft> = {}) =>
    draftOf({
      runtime: 'kubevirt-vm',
      scope: 'user',
      resourceChoices: [vmChoice],
      resources: { vm: { cpu: '4', memory: '8Gi' } },
      networkChoices: { internet: { default: true }, podNetwork: { default: false } },
      network: { internet: true, podNetwork: false },
      ...over,
    } as never)

  it('lists resources, internet access and networked desktops, in this order', () => {
    expect(kinds(rowsOf(vm()))).toEqual(['resources', 'network:internet', 'network:podNetwork'])
  })

  it('shows the recommended resources with the sum for everybody, as every person gets a desktop', () => {
    const [row] = rowsOf(vm())
    expect(row).toMatchObject({
      kind: 'resources',
      unit: 'desktop',
      cpu: 4,
      memoryGb: '8',
      changed: false,
      total: { people: 3, cpu: 12, memoryGb: '24' },
    })
  })

  it('marks changed resources', () => {
    const [row] = rowsOf(vm({ resources: { vm: { cpu: '6', memory: '12Gi' } } }))
    expect(row).toMatchObject({ cpu: 6, memoryGb: '12', changed: true, total: { cpu: 18, memoryGb: '36' } })
  })

  it('leaves the sum out for a single person: it would repeat the row', () => {
    const one = vm({ studentIds: ['u1'], groupCount: 1, groupNames: ['Team #1'], assignments: [['u1']] })
    expect(rowsOf(one)[0]).toMatchObject({ kind: 'resources', total: null })
  })

  it('leaves the sum out when the environments are not per person', () => {
    const [row] = rowsOf(vm({ scope: 'team' }))
    expect(row).toMatchObject({ kind: 'resources', total: null })
  })

  it('shows internet access also at its default, not only when it differs', () => {
    const net = rowsOf(vm()).filter((r) => r.kind === 'network')
    expect(net[0]).toMatchObject({ key: 'internet', on: true, unit: 'desktop' })
    expect(net[1]).toMatchObject({ key: 'podNetwork', on: false, unit: 'desktop' })
  })

  it('shows what was chosen', () => {
    const net = rowsOf(vm({ network: { internet: false, podNetwork: true } })).filter((r) => r.kind === 'network')
    expect(net.map((r) => (r as Extract<SettingsRow, { kind: 'network' }>).on)).toEqual([false, true])
  })

  it('leaves out networked desktops for a single person', () => {
    const one = vm({ studentIds: ['u1'], groupCount: 1, groupNames: ['Team #1'], assignments: [['u1']] })
    expect(kinds(rowsOf(one))).toEqual(['resources', 'network:internet'])
  })

  it('leaves out internet access when the app does not release it', () => {
    expect(kinds(rowsOf(vm({ networkChoices: { podNetwork: { default: false } } })))).toEqual(['resources', 'network:podNetwork'])
  })

  it('is a pod environment for pod apps', () => {
    const pods = draftOf({ runtime: 'kubernetes', networkChoices: { internet: { default: false } }, network: { internet: false } })
    expect(rowsOf(pods)[0]).toMatchObject({ kind: 'network', key: 'internet', on: false, unit: 'pod' })
  })

  it('uses the author default when nothing was chosen yet', () => {
    const net = rowsOf(vm({ network: undefined })).filter((r) => r.kind === 'network')
    expect(net.map((r) => (r as Extract<SettingsRow, { kind: 'network' }>).on)).toEqual([true, false])
  })
})

describe('buildSettingsRows: text and choice variables (type D)', () => {
  it('gives a row per variable with the value of the draft, else the default', () => {
    const defs = [textVar(), textVar({ name: 'size', default: 'S' })]
    const rows = rowsOf(draftOf({ variableDefinitions: defs, variables: { region: 'eu-west' } }), defs)
    expect(rows).toEqual([
      expect.objectContaining({ kind: 'value', label: 'Region', lines: [{ slot: null, text: 'eu-west' }] }),
      expect.objectContaining({ kind: 'value', label: 'Size', lines: [{ slot: null, text: 'S' }] }),
    ])
  })

  it('formats booleans and lists like the old summary', () => {
    const defs = [textVar({ name: 'debug', default: true }), textVar({ name: 'tags', default: ['a', 'b'] })]
    const rows = rowsOf(draftOf({ variableDefinitions: defs, variables: {} }), defs)
    expect(rows.map((r) => (r as Extract<SettingsRow, { kind: 'value' }>).lines[0]!.text)).toEqual(['deployment.summary.yes', 'a, b'])
  })

  it('gives a line per team for values that differ per team', () => {
    const defs = [textVar({ name: 'db_name', varScope: 'team' })]
    const variables = { db_name: { 'Team #1': 'a-db', 'Team #2': 'b-db' } }
    const [row] = rowsOf(draftOf({ variableDefinitions: defs, variables }), defs)
    expect((row as Extract<SettingsRow, { kind: 'value' }>).lines).toEqual([
      { slot: 'Team #1', text: 'a-db' },
      { slot: 'Team #2', text: 'b-db' },
    ])
  })

  it('shows a dash for a scoped variable nobody filled in', () => {
    const defs = [textVar({ name: 'db_name', varScope: 'team', default: undefined })]
    const [row] = rowsOf(draftOf({ variableDefinitions: defs, variables: {} }), defs)
    expect((row as Extract<SettingsRow, { kind: 'value' }>).lines).toEqual([{ slot: null, text: '-' }])
  })

  it('does not list file variables as values', () => {
    const defs = [fileVar({ default: {} as never })]
    expect(kinds(rowsOf(draftOf({ variableDefinitions: defs }), defs))).toEqual(['file'])
  })
})

describe('buildSettingsRows: order', () => {
  it('puts resources, networks, files and values in this order', () => {
    const defs = [textVar(), fileVar()]
    const draft = draftOf({
      runtime: 'kubevirt-vm',
      scope: 'user',
      variableDefinitions: defs,
      resourceChoices: [vmChoice],
      resources: { vm: { cpu: '4', memory: '8Gi' } },
      networkChoices: { internet: { default: true }, podNetwork: { default: false } },
    } as never)
    expect(kinds(rowsOf(draft))).toEqual(['resources', 'network:internet', 'network:podNetwork', 'file', 'value'])
  })
})

describe('the card and step 3 answer the same question from one place (issue 133)', () => {
  // Each case is an app type of the issue: the card exists exactly when the step "Variablen" does.
  const cases: Array<[string, Partial<DeploymentDraft>, AppVariable[]]> = [
    ['A: nothing to set', {}, []],
    ['B: optional file', { fileUploads: {} }, [fileVar()]],
    [
      'C: Windows VM',
      {
        runtime: 'kubevirt-vm',
        scope: 'user',
        resourceChoices: [vmChoice],
        resources: { vm: { cpu: '4', memory: '8Gi' } },
        networkChoices: { internet: { default: true }, podNetwork: { default: false } },
      } as never,
      [],
    ],
    ['C: Windows VM without a choice (v2.0.0)', { runtime: 'kubevirt-vm', scope: 'user' }, []],
    ['D: text variables', {}, [textVar()]],
    [
      'pods with a network switch and two teams',
      { networkChoices: { podNetwork: { default: false } }, groupCount: 2 },
      [],
    ],
    [
      'pods with a network switch and one team',
      {
        networkChoices: { podNetwork: { default: false } },
        studentIds: ['u1'],
        groupCount: 1,
        groupNames: ['Team #1'],
        assignments: [['u1']],
      },
      [],
    ],
  ]

  it.each(cases)('%s', (_name, over, defs) => {
    const draft = draftOf({ ...over, variableDefinitions: defs })
    expect(rowsOf(draft, defs).length > 0).toBe(needsVariablesStep(draft) === true)
  })
})
