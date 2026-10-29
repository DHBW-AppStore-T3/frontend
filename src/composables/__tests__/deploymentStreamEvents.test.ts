import { describe, it, expect } from 'vitest'
import { parseLog, parseProgress, parseSnapshot } from '../deploymentStreamEvents'

const NOT_OBJECTS = [undefined, null, 'text', 42, true, [], [1, 2]]

describe('parseSnapshot', () => {
  it('returns the read fields of a complete snapshot and drops the rest', () => {
    expect(
      parseSnapshot({ task_id: 't', status: 'RUNNING', current_phase: 'A', progress_pct: 12.5, type: 'deploy', extra: 1 }),
    ).toEqual({ status: 'RUNNING', current_phase: 'A', progress_pct: 12.5 })
  })

  it('accepts a snapshot of a deployment without task and normalises missing fields to null', () => {
    const all = { status: null, current_phase: null, progress_pct: null }
    expect(parseSnapshot({ task_id: null, ...all, type: null })).toEqual(all)
    expect(parseSnapshot({})).toEqual(all)
  })

  it('keeps progress 0', () => {
    expect(parseSnapshot({ status: 'RUNNING', progress_pct: 0 })?.progress_pct).toBe(0)
  })

  it.each(NOT_OBJECTS)('rejects a non-object payload (%j)', (data) => {
    expect(parseSnapshot(data)).toBeNull()
  })

  it.each([
    { status: 7 },
    { status: {} },
    { current_phase: 3 },
    { progress_pct: '50' },
    { progress_pct: NaN },
    { progress_pct: Infinity },
  ])('rejects wrongly typed read fields (%j)', (bad) => {
    expect(parseSnapshot({ status: 'RUNNING', ...bad })).toBeNull()
  })
})

describe('parseProgress', () => {
  const valid = { phase: 'A', phase_index: 1, total_phases: 3, progress_pct: 33 }

  it('accepts a complete event with and without phase_names', () => {
    expect(parseProgress(valid)).toEqual(valid)
    expect(parseProgress({ ...valid, phase_names: ['A', 'B', 'C'] })).toEqual({ ...valid, phase_names: ['A', 'B', 'C'] })
  })

  it('keeps zero values', () => {
    expect(parseProgress({ phase: 'INIT', phase_index: 0, total_phases: 1, progress_pct: 0 })).not.toBeNull()
  })

  it('ignores extra fields', () => {
    expect(parseProgress({ ...valid, message: 'x', iso_timestamp: 't', deployment_id: 'd' })).toEqual(valid)
  })

  it('ignores a phase_names value that is not an array, as before', () => {
    expect(parseProgress({ ...valid, phase_names: 'A,B' })).toEqual(valid)
    expect(parseProgress({ ...valid, phase_names: null })).toEqual(valid)
  })

  it.each(['phase', 'phase_index', 'total_phases', 'progress_pct'])('rejects a missing %s', (field) => {
    const { [field]: _omitted, ...rest } = valid as Record<string, unknown>
    expect(parseProgress(rest)).toBeNull()
  })

  it.each([
    { phase: 1 },
    { phase: null },
    { phase_index: '1' },
    { total_phases: null },
    { progress_pct: '33' },
    { progress_pct: NaN },
    { phase_names: ['A', 2] },
  ])('rejects wrongly typed fields (%j)', (bad) => {
    expect(parseProgress({ ...valid, ...bad })).toBeNull()
  })

  it.each(NOT_OBJECTS)('rejects a non-object payload (%j)', (data) => {
    expect(parseProgress(data)).toBeNull()
  })
})

describe('parseLog', () => {
  const now = () => 'NOW'
  const valid = { level: 'INFO', message: 'hello' }

  it('re-keys iso_timestamp to timestamp and keeps everything else', () => {
    expect(parseLog({ ...valid, iso_timestamp: 'iso', timestamp: 'plain', returncode: 0 }, now)).toEqual({
      ...valid, iso_timestamp: 'iso', timestamp: 'iso', returncode: 0,
    })
  })

  it('falls back to timestamp, then to the injected now', () => {
    expect(parseLog({ ...valid, timestamp: 'plain' }, now)?.timestamp).toBe('plain')
    expect(parseLog(valid, now)?.timestamp).toBe('NOW')
    expect(parseLog({ ...valid, iso_timestamp: '', timestamp: '' }, now)?.timestamp).toBe('NOW')
  })

  it('accepts an empty message', () => {
    expect(parseLog({ level: 'INFO', message: '' }, now)).not.toBeNull()
  })

  it('accepts the optional fields when well typed and drops explicit nulls', () => {
    expect(parseLog({ ...valid, tool: 'terraform', category: 'c', streaming: false }, now)).toMatchObject({
      tool: 'terraform', category: 'c', streaming: false,
    })
    const entry = parseLog({ ...valid, tool: null, category: null, streaming: null }, now)!
    expect('tool' in entry || 'category' in entry || 'streaming' in entry).toBe(false)
  })

  it.each([{ level: undefined }, { message: undefined }, { level: 3 }, { message: { a: 1 } }])(
    'rejects missing or wrongly typed level/message (%j)',
    (bad) => {
      expect(parseLog({ ...valid, ...bad }, now)).toBeNull()
    },
  )

  it.each([
    { iso_timestamp: 1767225600 },
    { timestamp: 1767225600.5 },
    { tool: 5 },
    { category: [] },
    { streaming: 'yes' },
  ])('rejects wrongly typed optional fields that the UI reads (%j)', (bad) => {
    expect(parseLog({ ...valid, ...bad }, now)).toBeNull()
  })

  it.each(NOT_OBJECTS)('rejects a non-object payload (%j)', (data) => {
    expect(parseLog(data, now)).toBeNull()
  })

  it('does not mutate the input', () => {
    const input = { ...valid, iso_timestamp: 'iso' }
    parseLog(input, now)
    expect(input).toEqual({ ...valid, iso_timestamp: 'iso' })
  })
})
