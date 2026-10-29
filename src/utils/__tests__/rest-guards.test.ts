import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseTask, parseTaskList, parseDeploymentDetail, parseStoredUserInput } from '../rest-guards'
import { parseGroups, parseVariables } from '@/views/deployment-detail/helpers'

afterEach(() => vi.restoreAllMocks())
const quiet = () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
}

const task = { taskId: 't1', deploymentId: 'd1', type: 'deploy', status: 'running', created_at: '2026-01-01T00:00:00Z' }

describe('parseTask', () => {
  it('accepts a task and defaults an absent logs to null', () => {
    expect(parseTask(task)).toEqual({ ...task, logs: null })
  })

  it('keeps string logs, progress and extra fields', () => {
    const full = { ...task, logs: '[]', progress_pct: 40, current_phase: 'PLAN', started_at: null, extra: 1 }
    expect(parseTask(full)).toEqual(full)
  })

  it.each([
    ['null', null],
    ['a list', [task]],
    ['no taskId', { ...task, taskId: undefined }],
    ['no status', { ...task, status: undefined }],
    ['a numeric type', { ...task, type: 3 }],
    ['no created_at (sorting would throw)', { ...task, created_at: undefined }],
  ])('rejects %s', (_label, raw) => {
    expect(parseTask(raw)).toBeNull()
  })

  it.each([
    ['logs', { logs: { logs: [] } }],
    ['progress_pct', { progress_pct: '40' }],
    ['current_phase', { current_phase: 7 }],
  ])('drops a wrong %s with a warning', (key, extra) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = parseTask({ ...task, ...extra })
    expect(result).not.toBeNull()
    expect((result as Record<string, unknown>)[key]).toBe(key === 'logs' ? null : undefined)
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

describe('parseTaskList', () => {
  it('keeps the usable entries and drops the others', () => {
    quiet()
    expect(parseTaskList([task, null, { nope: 1 }, { ...task, taskId: 't2' }]).map((t) => t.taskId)).toEqual(['t1', 't2'])
  })

  it.each([['an object', { tasks: [] }], ['null', null], ['a string', 'x']])('treats %s as empty', (_l, raw) => {
    quiet()
    expect(parseTaskList(raw)).toEqual([])
  })
})

const deployment = { deploymentId: 'd1', status: 'success', name: 'Lab', teams: [], permissions: { owner_view: true } }

describe('parseDeploymentDetail', () => {
  it('accepts a deployment and keeps extra fields', () => {
    const full = { ...deployment, outputs: null, userInputVar: '{"a":1}', extra: true }
    expect(parseDeploymentDetail(full)).toEqual(full)
  })

  it('accepts userInputVar as an object', () => {
    expect(parseDeploymentDetail({ ...deployment, userInputVar: { a: 1 } })).toMatchObject({ userInputVar: { a: 1 } })
  })

  it.each([
    ['null', null],
    ['a list', []],
    ['no id', { ...deployment, deploymentId: undefined }],
    ['an empty id', { ...deployment, deploymentId: '' }],
    ['no status', { ...deployment, status: undefined }],
  ])('rejects %s', (_label, raw) => {
    expect(parseDeploymentDetail(raw)).toBeNull()
  })

  it.each([
    ['teams', { teams: 'none' }],
    ['permissions', { permissions: 'all' }],
    ['outputs', { outputs: [] }],
    ['userInputVar', { userInputVar: 5 }],
    ['name', { name: 7 }],
  ])('drops a wrong %s with a warning, rights are not guessed', (key, extra) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = parseDeploymentDetail({ ...deployment, ...extra })
    expect(result).not.toBeNull()
    expect(result).not.toHaveProperty(key)
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

describe('parseStoredUserInput', () => {
  it('reads text and objects alike', () => {
    const value = { groupNames: ['A'], assignments: { 0: ['s1'] }, variables: { v: 'x' } }
    const expected = { groupNames: ['A'], assignments: { 0: ['s1'] }, variables: { v: 'x' } }
    expect(parseStoredUserInput(JSON.stringify(value))).toEqual(expected)
    expect(parseStoredUserInput(value)).toEqual(expected)
  })

  it('reads assignments stored as a list of lists', () => {
    expect(parseStoredUserInput({ assignments: [['a'], ['b', 'c']] })?.assignments).toEqual({ 0: ['a'], 1: ['b', 'c'] })
  })

  it('falls back to empty parts', () => {
    expect(parseStoredUserInput({})).toEqual({ groupNames: [], assignments: {}, variables: {} })
  })

  it.each([['a number', 5], ['null', null], ['a list', []], ['a bare string', '"x"'], ['broken JSON', '{nope']])(
    'gives null for %s',
    (_l, raw) => {
      quiet()
      expect(parseStoredUserInput(raw)).toBeNull()
    },
  )

  it.each([
    ['groupNames that is not a list', { groupNames: 'A', assignments: { 0: ['s'] } }, { groupNames: [], assignments: { 0: ['s'] }, variables: {} }],
    ['groupNames with a number', { groupNames: ['A', 2] }, { groupNames: ['A', ''], assignments: {}, variables: {} }],
    ['assignments that is a string', { assignments: 'x' }, { groupNames: [], assignments: {}, variables: {} }],
    ['assignments with a non-list member entry', { assignments: { 0: 'x', 1: ['a', 3] } }, { groupNames: [], assignments: { 0: [], 1: ['a'] }, variables: {} }],
    ['variables that is a list', { variables: ['a'] }, { groupNames: [], assignments: {}, variables: {} }],
    ['variables with numbers', { variables: { n: 3, z: null } }, { groupNames: [], assignments: {}, variables: { n: '3', z: '' } }],
  ])('repairs %s', (_l, raw, expected) => {
    quiet()
    expect(parseStoredUserInput(raw)).toEqual(expected)
  })
})

describe('parseGroups / parseVariables with broken userInputVar (previously crashed or mis-rendered)', () => {
  it('does not throw on groupNames/assignments of the wrong type', () => {
    quiet()
    expect(parseGroups({ groupNames: 'A', assignments: 'x' })).toEqual([])
    expect(parseGroups({ groupNames: 5, assignments: { 0: 'x' } })).toEqual([{ index: 0, name: 'Gruppe 1', students: [] }])
  })

  it('returns variables as strings only', () => {
    quiet()
    expect(parseVariables({ variables: { a: 1 } })).toEqual({ a: '1' })
    expect(parseVariables({ variables: 7 })).toEqual({})
  })
})
