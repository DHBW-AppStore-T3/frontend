import { describe, it, expect } from 'vitest'
import {
  teamVmsOf,
  ownAccountOf,
  enrichTeams,
  accessLinkFor,
  logEntryCount,
  splitTaskLogs,
  getStatusStyles,
  parseGroups,
  parseVariables,
  cleanVariableValue,
  sortByCreatedDesc,
  pickActiveTask,
} from '../helpers'

const account = { username: 'lea.meyer', team: 'Team A', ip: '10.0.0.1', port: 22, auth: 'pw' }
const teams = [
  {
    teamId: 't1',
    name: 'Team A',
    members: [
      { userId: 'u-lea', username: 'lea.meyer', email: 'lea.meyer@x.de' },
      { userId: 'u-max', username: 'max', email: 'max@x.de' },
    ],
  },
  { teamId: 't2', name: 'Team B', members: [{ userId: 'u-ann', username: 'ann', email: 'ann@x.de' }] },
] as any

describe('teamVmsOf', () => {
  it('reads every team from the redacted outputs of the owner view', () => {
    const outputs = { raw: { team_vms: { value: { 'Team A': { url: 'https://a' } } } } }
    expect(teamVmsOf(outputs, { 'Team X': { url: 'https://x' } })).toEqual({ 'Team A': { url: 'https://a' } })
  })

  it('falls back to the own team of /my-access, then to nothing', () => {
    expect(teamVmsOf(undefined, { 'Team A': { url: 'https://a' } })).toEqual({ 'Team A': { url: 'https://a' } })
    expect(teamVmsOf(null, null)).toEqual({})
    expect(teamVmsOf({ raw: { team_vms: { value: 'nope' } } }, null)).toEqual({})
  })
})

describe('ownAccountOf', () => {
  it('is the single entry /my-access names', () => {
    expect(ownAccountOf({ 'team-a-lea': account })).toEqual({ key: 'team-a-lea', data: account })
  })

  it('is null for none or several entries (never guess which is the caller\'s)', () => {
    expect(ownAccountOf(null)).toBeNull()
    expect(ownAccountOf({})).toBeNull()
    expect(ownAccountOf({ a: account, b: account })).toBeNull()
  })
})

describe('enrichTeams', () => {
  const own = { key: 'team-a-lea', data: account }

  it('attaches the account only to the caller\'s own row, found by user id', () => {
    const [teamA, teamB] = enrichTeams(teams, {}, 'u-lea', own)

    expect(teamA!.members.map((m) => m.account)).toEqual([own, null])
    expect(teamB!.members[0]!.account).toBeNull()
  })

  it('never hands another member the caller\'s credentials, whatever the names say', () => {
    const lookalike = { ...teams[0], members: [{ userId: 'u-other', username: 'lea.meyer', email: 'lea.meyer@x.de' }] }

    expect(enrichTeams([lookalike] as any, {}, 'u-lea', own)[0]!.members[0]!.account).toBeNull()
  })

  it('compares ids as strings', () => {
    expect(enrichTeams(teams, {}, 7 as any, own)[0]!.members.every((m) => m.account === null)).toBe(true)
    expect(enrichTeams([{ ...teams[0], members: [{ userId: 7 }] }] as any, {}, 7 as any, own)[0]!.members[0]!.account).toBe(own)
  })

  it('yields no account without a caller or an own account', () => {
    expect(enrichTeams(teams, {}, undefined, own)[0]!.members.map((m) => m.account)).toEqual([null, null])
    expect(enrichTeams(teams, {}, 'u-lea', null)[0]!.members.map((m) => m.account)).toEqual([null, null])
  })

  it('attaches the team vm block by team name', () => {
    const [teamA, teamB] = enrichTeams(teams, { 'Team A': { url: 'https://a' } }, 'u-lea', own)

    expect(teamA!.vm).toEqual({ url: 'https://a' })
    expect(teamB!.vm).toBeNull()
  })

  it('tolerates a deployment without teams', () => {
    expect(enrichTeams(undefined, {}, 'u-lea', own)).toEqual([])
  })

  it('attaches the link of a member\'s own workload (scope: user), found by user id', () => {
    const workloads = [
      { workload: 'ide-lea', user_id: 'u-lea', url: 'https://ide-lea.example' },
      { workload: 'ide-max', user_id: 'u-max', url: 'https://ide-max.example' },
      { workload: 'ide-team', user_id: null, url: 'https://ide-team.example' },
    ] as any

    const [teamA, teamB] = enrichTeams(teams, {}, undefined, null, workloads)

    expect(teamA!.members.map((m) => m.workloadUrl)).toEqual(['https://ide-lea.example', 'https://ide-max.example'])
    expect(teamB!.members[0]!.workloadUrl).toBeNull()
  })

  it('has no workload link without workloads', () => {
    expect(enrichTeams(teams, {}, 'u-lea', own)[0]!.members.map((m) => m.workloadUrl)).toEqual([null, null])
  })
})

describe('accessLinkFor', () => {
  it('builds the link from ip and port of an address-style account, keeping the team url\'s path', () => {
    expect(accessLinkFor({ ip: '10.0.0.5', port: 8080, type: 'password' }, 'https://t.example/pgadmin4', null)).toBe(
      'http://10.0.0.5:8080/pgadmin4',
    )
  })

  it('does not build a web link from ssh, rdp or port 22 accounts', () => {
    expect(accessLinkFor({ ip: '10.0.0.5', port: 22 }, null, null)).toBeNull()
    expect(accessLinkFor({ ip: '10.0.0.5', port: 2222, type: 'ssh_key' }, null, null)).toBeNull()
    expect(accessLinkFor({ ip: '10.0.0.5', port: 3389, authtype: 'rdp' }, null, null)).toBeNull()
    expect(accessLinkFor({ ip: '10.0.0.5', port: 2222, authtype: 'ssh' }, null, null)).toBeNull()
  })

  it('uses the account\'s own url: a pod account has no ip and port (scope: user has no team url)', () => {
    expect(accessLinkFor({ url: 'https://ide-lea.example' }, null, null)).toBe('https://ide-lea.example')
    expect(accessLinkFor({ url: 'https://ide-lea.example' }, 'https://team.example', null)).toBe(
      'https://ide-lea.example',
    )
  })

  it('falls back to the member\'s workload, then to the team url', () => {
    expect(accessLinkFor(null, 'https://team.example', 'https://ide-lea.example')).toBe('https://ide-lea.example')
    expect(accessLinkFor(null, 'https://team.example', null)).toBe('https://team.example')
    expect(accessLinkFor({ username: 'lea' }, 'https://team.example', null)).toBe('https://team.example')
  })

  it('is null when nothing is known', () => {
    expect(accessLinkFor(null, null, null)).toBeNull()
    expect(accessLinkFor(undefined, undefined, undefined)).toBeNull()
    expect(accessLinkFor({ url: null }, '', '')).toBeNull()
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
