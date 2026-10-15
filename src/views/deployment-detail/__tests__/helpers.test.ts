import { describe, it, expect } from 'vitest'
import {
  extractUserAccounts,
  extractTeamVms,
  enrichTeams,
  countTfResources,
  logEntryCount,
  splitTaskLogs,
  getStatusStyles,
  parseGroups,
  parseVariables,
  cleanVariableValue,
  sortByCreatedDesc,
  pickActiveTask,
} from '../helpers'

const accounts = {
  'team a-lea-meyer': { username: 'lea.meyer', team: 'Team A', ip: '10.0.0.1', port: 22, auth: 'pw' },
}

describe('extractUserAccounts / extractTeamVms', () => {
  it('reads user_accounts from an object output', () => {
    const outputs = { user_accounts: { value: accounts } }
    expect(extractUserAccounts(outputs, null)).toBe(accounts)
  })

  it('parses a JSON string output', () => {
    const outputs = JSON.stringify({ user_accounts: { value: accounts }, team_vms: { value: { 'Team A': { url: 'https://x' } } } })
    expect(extractUserAccounts(outputs, null)).toEqual(accounts)
    expect(extractTeamVms(outputs, null)).toEqual({ 'Team A': { url: 'https://x' } })
  })

  it('falls back to the member data when there are no outputs', () => {
    const mine = { k: { username: 'x', team: 't', ip: '', port: 0, auth: '' } }
    expect(extractUserAccounts(null, mine)).toBe(mine)
    expect(extractTeamVms(undefined, { T: { url: 'u' } })).toEqual({ T: { url: 'u' } })
  })

  it('falls back on unparsable or irrelevant outputs', () => {
    expect(extractUserAccounts('{broken', 'fallback' as any)).toBe('fallback')
    expect(extractUserAccounts({ other: 1 }, null)).toBeNull()
    expect(extractTeamVms('{broken', null)).toBeNull()
  })
})

describe('enrichTeams', () => {
  const team = (members: any[], name = 'Team A') => ({ teamId: 't1', name, members })

  it('matches by the derived terraform key (team + email local part, dots→dashes)', () => {
    const [t] = enrichTeams([team([{ userId: 'u1', username: 'lea', email: 'Lea.Meyer@x.de' }])], accounts, null)
    expect(t!.members[0]!.account?.key).toBe('team a-lea-meyer')
  })

  it('matches by email in account.username', () => {
    const acc = { k1: { username: 'lea@x.de', team: 'Team A', ip: '', port: 0, auth: '' } }
    const [t] = enrichTeams([team([{ userId: 'u', username: 'zzz', email: 'lea@x.de' }])], acc, null)
    expect(t!.members[0]!.account?.key).toBe('k1')
  })

  it('matches by username substring against account.username and key', () => {
    const acc = { 'team a-bob': { username: 'bobby', team: 'Team A', ip: '', port: 0, auth: '' } }
    const [t] = enrichTeams([team([{ userId: 'u', username: 'bob', email: 'other@x.de' }])], acc, null)
    expect(t!.members[0]!.account?.key).toBe('team a-bob')
  })

  it('never attaches an account of another team', () => {
    const acc = { 'team b-lea-meyer': { username: 'lea.meyer', team: 'Team B', ip: '', port: 0, auth: '' } }
    const [t] = enrichTeams([team([{ userId: 'u', username: 'lea', email: 'lea.meyer@x.de' }])], acc, null)
    expect(t!.members[0]!.account).toBeNull()
  })

  it('attaches the team vm block by team name', () => {
    const [t] = enrichTeams([team([])], null, { 'Team A': { url: 'https://vm' } })
    expect(t!.vm).toEqual({ url: 'https://vm' })
  })

  it('yields null accounts when there are no accounts at all', () => {
    const [t] = enrichTeams([team([{ userId: 'u', username: 'a', email: 'a@x.de' }])], null, null)
    expect(t!.members[0]!.account).toBeNull()
    expect(t!.vm).toBeNull()
  })
})

describe('countTfResources', () => {
  it('counts resources in object and string state', () => {
    expect(countTfResources({ resources: [1, 2] })).toBe(2)
    expect(countTfResources(JSON.stringify({ resources: [1] }))).toBe(1)
  })
  it('returns 0 for missing or invalid state', () => {
    expect(countTfResources(null)).toBe(0)
    expect(countTfResources('{x')).toBe(0)
    expect(countTfResources({})).toBe(0)
  })
})

describe('logEntryCount', () => {
  it('handles array, object-with-logs and JSON-string shapes', () => {
    expect(logEntryCount([1, 2, 3])).toBe(3)
    expect(logEntryCount({ logs: [1, 2] })).toBe(2)
    expect(logEntryCount(JSON.stringify({ logs: [1] }))).toBe(1)
    expect(logEntryCount(JSON.stringify([1, 2]))).toBe(2)
  })
  it('returns null when it cannot be determined', () => {
    expect(logEntryCount(null)).toBeNull()
    expect(logEntryCount('plain text')).toBeNull()
    expect(logEntryCount('{broken}')).toBeNull()
    expect(logEntryCount({})).toBeNull()
  })
})

describe('splitTaskLogs', () => {
  it('splits on the technical-details divider', () => {
    expect(splitTaskLogs('Worker lost\n--- Technische Details ---\nTrace…')).toEqual({
      headline: 'Worker lost',
      details: 'Trace…',
      isFailure: true,
    })
  })
  it('uses the first line of a legacy "Task failed:" string', () => {
    expect(splitTaskLogs('Task failed: boom\nTraceback')).toEqual({
      headline: 'Task failed: boom',
      details: 'Traceback',
      isFailure: true,
    })
    expect(splitTaskLogs('Task failed: boom')).toEqual({ headline: 'Task failed: boom', details: '', isFailure: true })
  })
  it('is a non-failure for anything else', () => {
    expect(splitTaskLogs('all good')).toEqual({ headline: '', details: '', isFailure: false })
    expect(splitTaskLogs(null)).toEqual({ headline: '', details: '', isFailure: false })
  })
})

describe('getStatusStyles', () => {
  it.each([
    ['success', 'DeploymentsView.deploymentSuccessful'],
    ['running', 'DeploymentsView.deploymentRunning'],
    ['paused', 'DeploymentsView.deploymentPaused'],
    ['resume_failed', 'DeploymentsView.deploymentResumeFailed'],
  ])('maps %s', (status, label) => {
    expect(getStatusStyles(status).label).toBe(label)
  })
  it('falls back for unknown or missing status', () => {
    expect(getStatusStyles(undefined).label).toBe('DeploymentsView.noStatus')
    expect(getStatusStyles('weird').textClass).toBe('text-gray-400')
  })
})

describe('parseGroups / parseVariables', () => {
  const uiv = JSON.stringify({
    groupNames: ['A', 'B'],
    assignments: { 0: ['s1'], 1: ['s2', 's3'] },
    variables: { image: 'ubuntu # c' },
  })

  it('builds groups with names and students from a JSON string', () => {
    expect(parseGroups(uiv)).toEqual([
      { index: 0, name: 'A', students: ['s1'] },
      { index: 1, name: 'B', students: ['s2', 's3'] },
    ])
  })
  it('names groups when no group name is available', () => {
    expect(parseGroups({ assignments: { 2: ['x'] } })[0]!.name).toBe('Gruppe 3')
  })
  it('returns empty arrays/objects for missing or invalid input', () => {
    expect(parseGroups(null)).toEqual([])
    expect(parseGroups('{bad')).toEqual([])
    expect(parseVariables(undefined)).toEqual({})
    expect(parseVariables('{bad')).toEqual({})
  })
  it('extracts variables', () => {
    expect(parseVariables(uiv)).toEqual({ image: 'ubuntu # c' })
  })
})

describe('cleanVariableValue', () => {
  it('strips comments and quotes, falls back to "-"', () => {
    expect(cleanVariableValue('ubuntu:22.04 # default image')).toBe('ubuntu:22.04')
    expect(cleanVariableValue('"quoted"')).toBe('quoted')
    expect(cleanVariableValue('')).toBe('-')
    expect(cleanVariableValue(undefined)).toBe('-')
  })
})

describe('task ordering', () => {
  const tasks = [
    { taskId: 'old', created_at: '2026-01-01', status: 'success' },
    { taskId: 'new', created_at: '2026-02-01', status: 'success' },
    { taskId: 'run', created_at: '2026-01-15', status: 'running' },
  ] as any

  it('sorts newest first without mutating', () => {
    const copy = [...tasks]
    expect(sortByCreatedDesc(tasks).map((t: any) => t.taskId)).toEqual(['new', 'run', 'old'])
    expect(tasks).toEqual(copy)
  })

  it('prefers a live task as the active one, otherwise the newest', () => {
    expect(pickActiveTask(tasks)?.taskId).toBe('run')
    expect(pickActiveTask(tasks.filter((t: any) => t.status !== 'running'))?.taskId).toBe('new')
    expect(pickActiveTask([])).toBeNull()
  })
})
