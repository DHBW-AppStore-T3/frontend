import { describe, it, expect } from 'vitest'
import { buildFileSummaries, buildTerraformEntries, formatSubmitError, toSummaryEntry } from '../summary'

// Characterization of the summary step's edge cases (frontend#89), written by hand
// against the code BEFORE the any -> typed refactor and kept unchanged afterwards.
// Results that look like quirks are marked "quirk"; none of them is a fix.

const t = (key: string, o?: Record<string, unknown>) => (o ? `${key} ${JSON.stringify(o)}` : key)
const GENERIC = 'deployment.summary.submitError'
const err = (detail: unknown, message?: string) => ({ response: { data: { detail } }, message })
// formatSubmitError takes `any` today; the tests deliberately pass unusual shapes.
const submit = (e: unknown) => formatSubmitError(e as never, t)

describe('formatSubmitError: what the thrown value looks like', () => {
  it.each([[null], [undefined], ['boom'], [42], [{}], [{ response: {} }], [{ response: { data: {} } }]])(
    'falls back to the generic message for %j',
    (e) => {
      expect(submit(e)).toBe(GENERIC)
    },
  )

  it('uses the message of an Error, or of any object with one', () => {
    expect(submit(new Error('x'))).toBe('x')
    expect(submit({ message: 'm' })).toBe('m')
  })

  it('a string detail wins over the message', () => {
    expect(submit(err('from detail', 'from message'))).toBe('from detail')
  })

  it('quirk: an empty string detail is returned as it is (?? only skips null and undefined)', () => {
    expect(submit(err('', 'from message'))).toBe('')
  })

  it('a detail that is neither string nor object is ignored', () => {
    expect(submit(err(5, 'm'))).toBe('m')
    expect(submit(err(5))).toBe(GENERIC)
    expect(submit(err(true))).toBe(GENERIC)
  })

  it('an object or array detail without code or reason falls back to the message', () => {
    expect(submit(err({ message: 'ignored' }, 'em'))).toBe('em')
    expect(submit(err({ message: 'ignored' }))).toBe(GENERIC)
    expect(submit(err([], 'em'))).toBe('em')
    expect(submit(err([]))).toBe(GENERIC)
    expect(submit(err(null, 'em'))).toBe('em')
  })
})

describe('formatSubmitError: code and reason', () => {
  it('a known code wins over a reason in the same detail', () => {
    expect(submit(err({ code: 'role_required', reason: 'file_b64_invalid', filename: 'a' }))).toBe(
      'deployment.summary.errors.role_required',
    )
  })

  it('an unknown or empty code is skipped and the reason decides', () => {
    expect(submit(err({ code: 'unheard_of', reason: 'file_b64_invalid', filename: 'a' }))).toBe(
      'deployment.summary.errors.fileB64Invalid {"filename":"a"}',
    )
    expect(submit(err({ code: '', reason: 'file_b64_invalid', filename: 'a' }))).toContain('fileB64Invalid')
    expect(submit(err({ code: 'unheard_of' }, 'em'))).toBe('em')
  })

  it('an unknown reason, or one that only exists on Object.prototype, falls back', () => {
    expect(submit(err({ reason: 'weird' }, 'em'))).toBe('em')
    expect(submit(err({ reason: 'toString' }))).toBe(GENERIC)
    expect(submit(err({ reason: '' }, 'em'))).toBe('em')
  })

  it('a string detail is not read as an object', () => {
    expect(submit(err('file_too_large'))).toBe('file_too_large')
  })
})

describe('formatSubmitError: the file name', () => {
  const nameOf = (detail: Record<string, unknown>) => {
    const out = submit(err({ reason: 'file_b64_invalid', ...detail }))
    return JSON.parse(out.slice(out.indexOf('{'))).filename
  }

  it('prefers filename over variable/slot', () => {
    expect(nameOf({ filename: 'a.zip', variable: 'v', slot: 's' })).toBe('a.zip')
  })

  it('builds variable/slot when there is no filename (undefined or null)', () => {
    expect(nameOf({ variable: 'v', slot: 's' })).toBe('v/s')
    expect(nameOf({ filename: null, variable: 'v', slot: 's' })).toBe('v/s')
  })

  it('quirk: an empty filename is kept, and variable without slot gives nothing', () => {
    expect(nameOf({ filename: '', variable: 'v', slot: 's' })).toBe('')
    expect(nameOf({ variable: 'v' })).toBe('')
    expect(nameOf({ slot: 's' })).toBe('')
    expect(nameOf({})).toBe('')
  })

  it('turns a non-string filename into text', () => {
    expect(nameOf({ filename: 12 })).toBe('12')
  })
})

describe('formatSubmitError: numbers and lists in the details', () => {
  it.each([
    [3145728, '3.0'],
    [1572864, '1.5'],
    ['1048576', '1.0'],
    [0, '0.0'],
    [undefined, '0.0'],
    [null, '0.0'],
    ['', '0.0'],
    ['abc', 'NaN'], // quirk
  ])('shows %j bytes as %s MB', (bytes, mb) => {
    const out = submit(err({ reason: 'file_too_large', filename: 'f', actual_bytes: bytes, limit_bytes: 2097152 }))
    expect(out).toContain(`"actualMb":"${mb}"`)
    expect(out).toContain('"limitMb":"2.0"')
  })

  it('names the limit of too large deployments', () => {
    expect(submit(err({ reason: 'deployment_files_too_large', limit_bytes: 5242880 }))).toBe(
      'deployment.summary.errors.deploymentFilesTooLarge {"limitMb":"5.0"}',
    )
  })

  it('lists the allowed extensions only when they come as an array', () => {
    const allowedOf = (allowed: unknown) =>
      submit(err({ reason: 'file_extension_rejected', filename: 'x', allowed }))
    expect(allowedOf(['pdf', 'txt'])).toContain('"allowed":"pdf, txt"')
    expect(allowedOf([])).toContain('"allowed":""')
    expect(allowedOf('pdf')).toContain('"allowed":""')
    expect(allowedOf(undefined)).toContain('"allowed":""')
  })

  it('maps the size mismatch with the file name', () => {
    expect(submit(err({ reason: 'file_size_mismatch', filename: 'a' }))).toBe(
      'deployment.summary.errors.fileSizeMismatch {"filename":"a"}',
    )
  })

  it('uses 0 for missing workload numbers, and keeps 0 as it is', () => {
    expect(submit(err({ reason: 'workload_budget_exceeded' }))).toBe(
      'deployment.summary.errors.workload_budget_exceeded {"inUse":0,"requested":0,"budget":0}',
    )
    expect(submit(err({ reason: 'workload_budget_exceeded', in_use: 0, requested: 3, budget: null }))).toContain(
      '"inUse":0,"requested":3,"budget":0',
    )
  })

  it('passes limit and workloads of the plain reasons through, or an empty text', () => {
    expect(submit(err({ reason: 'too_many_workloads' }))).toBe(
      'deployment.summary.errors.too_many_workloads {"limit":"","workloads":""}',
    )
    expect(submit(err({ reason: 'too_many_workloads', limit: 0, workloads: 0 }))).toContain('"limit":0,"workloads":0')
    expect(submit(err({ reason: 'too_many_workloads', limit: null }))).toContain('"limit":""')
  })
})

describe('formatSubmitError: rejected file content', () => {
  const rejected = (extra: Record<string, unknown>) =>
    submit(err({ reason: 'file_content_rejected', filename: 'a.zip', ...extra }))

  it('translates a known code', () => {
    expect(rejected({ code: 'zip_bomb' })).toContain('"reason":"deployment.summary.errors.fileContent.zip_bomb"')
  })

  it('shows the server message for an unknown code, or an empty text without one', () => {
    expect(rejected({ code: 'new_code', message: 'English' })).toContain('"reason":"English"')
    expect(rejected({ code: 'new_code' })).toContain('"reason":""')
    expect(rejected({ code: 'new_code', message: null })).toContain('"reason":""')
  })

  it('treats a non-string code like no code', () => {
    expect(rejected({ code: 5, message: 'M' })).toContain('"reason":"M"')
    expect(rejected({ message: 'M' })).toContain('"reason":"M"')
  })
})

describe('buildTerraformEntries: draft value, default and gaps', () => {
  const ctx = { t }
  const def = (over: Record<string, unknown>) => ({ name: 'x', source: 'terraform', ...over }) as never

  it('uses the defaults when there are no variables at all', () => {
    expect(buildTerraformEntries([def({ default: 2 })], undefined, ctx)).toEqual([{ label: 'x', value: '2' }])
    expect(buildTerraformEntries([def({ default: 2 })], null, ctx)).toEqual([{ label: 'x', value: '2' }])
  })

  it('quirk: a draft value of null hides the default (only undefined falls through)', () => {
    expect(buildTerraformEntries([def({ default: 2 })], { x: null }, ctx)).toEqual([{ label: 'x', value: '-' }])
  })

  it.each([
    [false, 'deployment.summary.no'],
    [true, 'deployment.summary.yes'],
    [0, '0'],
    ['', '-'],
    ['plain', 'plain'],
    [['a', '"b"'], 'a, b'],
  ])('shows the draft value %j as %j', (value, shown) => {
    expect(buildTerraformEntries([def({ default: 'dflt' })], { x: value }, ctx)).toEqual([{ label: 'x', value: shown }])
  })

  it('shows "-" without a draft value and without a default', () => {
    expect(buildTerraformEntries([def({})], {}, ctx)).toEqual([{ label: 'x', value: '-' }])
  })

  it('keeps only terraform variables that are not files, in definition order', () => {
    const defs = [
      def({ name: 'a' }),
      def({ name: 'b', source: 'packer' }),
      def({ name: 'c', source: 'unknown' }),
      def({ name: 'd', osType: 'file' }),
      def({ name: 'e', osType: 'enum' }),
    ]
    expect(buildTerraformEntries(defs, { a: '1', e: 'v' }, ctx).map((e) => e.label)).toEqual(['a', 'e'])
  })
})

describe('toSummaryEntry: scoped values', () => {
  const ctx = { t }

  it('formats every slot value, including empty ones', () => {
    const entry = toSummaryEntry(
      { name: 's', varScope: 'user' } as never,
      { 'T-ann': 'x', 'T-bob': null, 'T-cy': true, 'T-di': ['a', 'b'] },
      ctx,
    )
    expect(entry.value).toBe('T-ann: x · T-bob: - · T-cy: deployment.summary.yes · T-di: a, b')
  })

  it('shows "-" for no value, an array or a non-object', () => {
    for (const val of [undefined, null, '', 'text', 5, ['a']]) {
      expect(toSummaryEntry({ name: 's', varScope: 'team' } as never, val, ctx).value).toBe('-')
    }
  })

  it('quirk: a scoped FILE variable is formatted like a plain value', () => {
    expect(toSummaryEntry({ name: 'f', varScope: 'team', osType: 'file' } as never, { a: 1 }, ctx).value).toBe(
      '[object Object]',
    )
  })

  it('uses osScope only for files, never for the scoped display', () => {
    expect(toSummaryEntry({ name: 's', osScope: 'team' } as never, { a: 1 }, ctx).value).toBe('[object Object]')
  })
})

describe('buildFileSummaries: metadata only', () => {
  it('shows name and size of the files, skipping null slots', () => {
    const defs = [{ name: 'k', osType: 'file', osScope: 'user' }] as never
    const uploads = {
      k: {
        a: { name: 'a.pem', size: 1500, content_b64: 'TOPSECRET', content_type: 'x' },
        b: null,
        c: { name: 'c.pem', size: 0, content_b64: 'MORESECRET', content_type: 'x' },
        d: { name: 'd.pem', content_b64: 'S', content_type: 'x' },
      },
    } as never

    const [summary] = buildFileSummaries(defs, uploads)

    expect(summary).toEqual({
      name: 'k',
      scope: 'user',
      chips: [
        { slot: 'a', filename: 'a.pem', size: '1 KB' },
        { slot: 'c', filename: 'c.pem', size: '0 B' },
        { slot: 'd', filename: 'd.pem', size: '0 B' },
      ],
    })
    expect(JSON.stringify(summary)).not.toMatch(/SECRET|content_b64/)
  })

  it('lists only file variables, each with its own scope', () => {
    const defs = [
      { name: 'a', osType: 'file', osScope: 'team' },
      { name: 'b', osType: 'enum' },
      { name: 'c', osType: 'file' },
    ] as never
    expect(buildFileSummaries(defs, undefined).map((s) => [s.name, s.scope, s.chips])).toEqual([
      ['a', 'team', []],
      ['c', 'all', []],
    ])
  })
})
