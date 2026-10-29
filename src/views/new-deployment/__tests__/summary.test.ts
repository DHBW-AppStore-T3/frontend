import { describe, it, expect } from 'vitest'
import {
  formatValue,
  toSummaryEntry,
  buildTerraformEntries,
  buildFileSummaries,
  formatSubmitError,
  versionLabelOf,
} from '../summary'

const t = (key: string, o?: Record<string, unknown>) => (o ? `${key} ${JSON.stringify(o)}` : key)

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

describe('toSummaryEntry', () => {
  const ctx = { t }

  it('formats plain values', () => {
    expect(toSummaryEntry({ name: 'count', type: 'number' } as any, 3, ctx)).toEqual({ label: 'count', value: '3' })
  })

  it('renders scoped values as "slot: value" lines', () => {
    const entry = toSummaryEntry({ name: 'size', varScope: 'team' } as any, { 'Team 1': 'S', 'Team 2': 'L' }, ctx)
    expect(entry.value).toBe('Team 1: S · Team 2: L')
    expect(toSummaryEntry({ name: 'size', varScope: 'team' } as any, {}, ctx).value).toBe('-')
    expect(toSummaryEntry({ name: 'size', varScope: 'user' } as any, 'oops', ctx).value).toBe('-')
  })
})

describe('entry builders', () => {
  const ctx = { t }
  const defs = [
    { name: 'cpu', source: 'terraform', default: 2 },
    { name: 'data', source: 'terraform', osType: 'file' },
  ] as any

  it('entries skip file variables and use the draft value over the default', () => {
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

  it('names the reason when the server rejects the content of a file', () => {
    const rejected = (code: string, message = 'english text') =>
      formatSubmitError(err({ reason: 'file_content_rejected', code, message, filename: 'a.zip' }), t)
    expect(rejected('zip_path_traversal')).toBe(
      'deployment.summary.errors.fileContentRejected {"filename":"a.zip","reason":"deployment.summary.errors.fileContent.zip_path_traversal"}',
    )
    // a code the frontend does not know yet falls back to the server's message
    expect(rejected('something_new', 'Something new happened')).toContain('"reason":"Something new happened"')
  })

  it.each(['version_not_approved', 'role_required', 'app_deactivated'])('maps the code %s', (code) => {
    expect(formatSubmitError(err({ code }), t)).toBe(`deployment.summary.errors.${code}`)
  })

  it.each([
    'invalid_teams',
    'member_in_several_teams',
    'too_many_workloads',
    'appstore_yaml_missing',
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

  it('names the owner storage quota with used, needed and limit in MB', () => {
    const detail = { reason: 'owner_storage_quota_exceeded', used_bytes: 200 * 1048576, needed_bytes: 80 * 1048576, limit_bytes: 256 * 1048576 }
    const message = formatSubmitError(err(detail), t)
    expect(message).toContain('deployment.summary.errors.ownerStorageQuotaExceeded')
    expect(message).toContain('"usedMb":"200.0"')
    expect(message).toContain('"neededMb":"80.0"')
    expect(message).toContain('"limitMb":"256.0"')
  })

  it('has a text for a full platform storage and for a body over the limit', () => {
    expect(formatSubmitError(err({ reason: 'upload_storage_full' }), t)).toContain('deployment.summary.errors.upload_storage_full')
    expect(formatSubmitError(err({ code: 'request_body_too_large', limit_bytes: 16777216 }), t)).toBe(
      'deployment.summary.errors.request_body_too_large',
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
