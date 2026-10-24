import { describe, it, expect } from 'vitest'
import {
  formatValue,
  renderOsValue,
  toSummaryEntry,
  buildPackerEntries,
  buildTerraformEntries,
  buildFileSummaries,
  formatSubmitError,
  versionLabelOf,
} from '../summary'

const t = (key: string, o?: Record<string, unknown>) => (o ? `${key} ${JSON.stringify(o)}` : key)
const noCache = () => null
const names = (known: Record<string, string>) => (_t: any, _m: any, v: string) =>
  known[v] ? { name: known[v], known: true } : null

describe('formatValue', () => {
  it.each([
    [true, 'deployment.summary.yes'],
    [false, 'deployment.summary.no'],
    [['"a"', 'b'], 'a, b'],
    ['["x"]', 'x'],
    [null, '-'],
    ['', '-'],
    [5, '5'],
  ])('%j → %s', (input, out) => {
    expect(formatValue(input, t)).toBe(out)
  })
})

describe('renderOsValue', () => {
  it('shows the cached display name and falls back to the raw value', () => {
    const lookup = names({ 'id-1': 'private-net' })
    expect(renderOsValue('network', 'id', 'id-1', false, lookup)).toBe('private-net')
    expect(renderOsValue('network', 'id', 'id-2', false, lookup)).toBe('id-2')
  })

  it('joins multi values from arrays and CSV strings', () => {
    const lookup = names({ a: 'A', b: 'B' })
    expect(renderOsValue('flavor', 'id', ['a', 'b'], true, lookup)).toBe('A, B')
    expect(renderOsValue('flavor', 'id', 'a, b', true, lookup)).toBe('A, B')
  })

  it('renders empty values as a dash', () => {
    expect(renderOsValue('flavor', 'id', '', false, noCache)).toBe('-')
    expect(renderOsValue('flavor', 'id', [], true, noCache)).toBe('-')
  })
})

describe('toSummaryEntry', () => {
  const ctx = { t, getDisplayName: names({ 'id-1': 'big' }) }

  it('formats plain values', () => {
    expect(toSummaryEntry({ name: 'count', type: 'number' } as any, 3, ctx)).toEqual({ label: 'count', value: '3' })
  })

  it('shows the display name for OpenStack markers and keeps the raw value as tooltip', () => {
    const entry = toSummaryEntry({ name: 'flavor', osType: 'flavor', osMode: 'id' } as any, 'id-1', ctx)
    expect(entry).toEqual({ label: 'flavor', value: 'big', raw: 'id-1' })
  })

  it('does not repeat the raw value when it equals the display', () => {
    expect(toSummaryEntry({ name: 'k', osType: 'keypair', osMode: 'name' } as any, 'key', ctx).raw).toBeUndefined()
  })

  it('renders scoped values as "slot: value" lines', () => {
    const entry = toSummaryEntry({ name: 'size', varScope: 'team' } as any, { 'Team 1': 'S', 'Team 2': 'L' }, ctx)
    expect(entry.value).toBe('Team 1: S · Team 2: L')
    expect(toSummaryEntry({ name: 'size', varScope: 'team' } as any, {}, ctx).value).toBe('-')
    expect(toSummaryEntry({ name: 'size', varScope: 'user' } as any, 'oops', ctx).value).toBe('-')
  })
})

describe('entry builders', () => {
  const ctx = { t, getDisplayName: noCache }
  const defs = [
    { name: 'region', source: 'packer', default: 'eu' },
    { name: 'cpu', source: 'terraform', default: 2 },
    { name: 'data', source: 'terraform', osType: 'file' },
    { name: 'img', source: 'packer', template_key: 'web', default: 'u' },
  ] as any

  it('flat packer entries fall back to the default', () => {
    expect(buildPackerEntries(defs.slice(0, 1), {}, ctx)).toEqual([{ label: 'region', value: 'eu' }])
  })

  it('multi-image packer entries are prefixed with the template key and read nested values', () => {
    const vars = { packer: { web: { img: 'ubuntu' } } }
    expect(buildPackerEntries([defs[3]], vars, ctx)).toEqual([{ label: '[web] img', value: 'ubuntu' }])
  })

  it('terraform entries skip file variables and use the draft value over the default', () => {
    expect(buildTerraformEntries(defs, { cpu: 4 }, ctx)).toEqual([{ label: 'cpu', value: '4' }])
    expect(buildTerraformEntries(defs, {}, ctx)).toEqual([{ label: 'cpu', value: '2' }])
  })
})

describe('buildFileSummaries', () => {
  it('lists uploaded slots by filename and size, never the content', () => {
    const defs = [{ name: 'task', osType: 'file', osScope: 'team' }] as any
    const uploads = { task: { 'Team 1': { name: 'a.pdf', size: 2048, content_b64: 'SECRET' }, 'Team 2': null } } as any
    const [summary] = buildFileSummaries(defs, uploads)
    expect(summary).toEqual({ name: 'task', scope: 'team', chips: [{ slot: 'Team 1', filename: 'a.pdf', size: '2 KB' }] })
    expect(JSON.stringify(summary)).not.toContain('SECRET')
  })

  it('defaults the scope to "all" and tolerates missing uploads', () => {
    expect(buildFileSummaries([{ name: 'x', osType: 'file' }] as any, {})[0]).toMatchObject({ scope: 'all', chips: [] })
  })
})

describe('formatSubmitError', () => {
  const err = (detail: unknown, message?: string) => ({ response: { data: { detail } }, message })

  it('maps known reasons with sizes in MB', () => {
    expect(
      formatSubmitError(err({ reason: 'file_too_large', filename: 'a.zip', actual_bytes: 3145728, limit_bytes: 2097152 }), t),
    ).toBe('deployment.summary.errors.fileTooLarge {"filename":"a.zip","actualMb":"3.0","limitMb":"2.0"}')
    expect(formatSubmitError(err({ reason: 'file_extension_rejected', filename: 'x.exe', allowed: ['pdf', 'txt'] }), t)).toContain(
      '"allowed":"pdf, txt"',
    )
    expect(formatSubmitError(err({ reason: 'file_b64_invalid', variable: 'v', slot: 's' }), t)).toContain('"filename":"v/s"')
  })

  it.each(['version_not_approved', 'role_required', 'app_deactivated'])('maps the code %s', (code) => {
    expect(formatSubmitError(err({ code }), t)).toBe(`deployment.summary.errors.${code}`)
  })

  it.each([
    'invalid_teams',
    'member_in_several_teams',
    'too_many_workloads',
    'openstack_credentials_unverified',
    'invalid_app_spec',
    'version_moved',
    'git_host_not_allowed',
  ])('maps the reason %s with the limit and workload numbers', (reason) => {
    expect(formatSubmitError(err({ reason, limit: 5, workloads: 9 }), t)).toBe(
      `deployment.summary.errors.${reason} {"limit":5,"workloads":9}`,
    )
  })

  it('names the workload budget with the numbers the teacher needs', () => {
    expect(formatSubmitError(err({ reason: 'workload_budget_exceeded', in_use: 8, requested: 4, budget: 10 }), t)).toBe(
      'deployment.summary.errors.workload_budget_exceeded {"inUse":8,"requested":4,"budget":10}',
    )
  })

  it('falls back to a string detail, the error message, then the generic key', () => {
    expect(formatSubmitError(err('plain detail'), t)).toBe('plain detail')
    expect(formatSubmitError({ message: 'boom' }, t)).toBe('boom')
    expect(formatSubmitError({}, t)).toBe('deployment.summary.submitError')
    expect(formatSubmitError(err({ reason: 'weird' }, 'm'), t)).toBe('m')
  })
})

describe('versionLabelOf', () => {
  it('uses object.version, a non-empty string, or latest', () => {
    expect(versionLabelOf({ version: 'v2' } as any)).toBe('v2')
    expect(versionLabelOf('v1')).toBe('v1')
    expect(versionLabelOf('  ')).toBe('latest')
    expect(versionLabelOf(null)).toBe('latest')
  })
})
