import { describe, expect, it } from 'vitest'
import type { AppVariable } from '@/types'
import { fileSlotKeysFor, type WizardTeam } from '../variableForm'
import { buildRecipients } from '../recipientRows'

const member = (userId: string, username: string) => ({ userId, username })
const names: Record<string, string> = { u1: 'Anna Berger', u2: 'Ben Köhler', u3: 'Carla Weiß' }
const nameOf = (id: string) => names[id] ?? id

const variable = (over: Partial<AppVariable> = {}): AppVariable => ({
  name: 'starter',
  type: 'string',
  osType: 'file',
  osScope: 'team',
  varScope: 'team',
  ...over,
})

describe('buildRecipients', () => {
  it('has a single shared slot for a deployment-wide variable', () => {
    const r = buildRecipients(variable({ osScope: 'all', varScope: 'all' }), [], nameOf)
    expect(r.kind).toBe('all')
    expect(r.rows).toEqual([{ id: 'all', name: '' }])
  })

  it('shows the person when every team is one person (an app that runs per person)', () => {
    const teams: WizardTeam[] = [
      { name: 'Team #1', members: [member('u1', 'anna')] },
      { name: 'Team #2', members: [member('u2', 'ben')] },
    ]
    const r = buildRecipients(variable(), teams, nameOf)
    expect(r.kind).toBe('person')
    expect(r.rows).toEqual([
      { id: 'Team #1', name: 'Anna Berger' },
      { id: 'Team #2', name: 'Ben Köhler' },
    ])
  })

  it('shows teams with their members when a team has several people', () => {
    const teams: WizardTeam[] = [
      { name: 'Alpha', members: [member('u1', 'anna'), member('u2', 'ben')] },
      { name: 'Beta', members: [member('u3', 'carla')] },
    ]
    const r = buildRecipients(variable(), teams, nameOf)
    expect(r.kind).toBe('team')
    expect(r.rows).toEqual([
      { id: 'Alpha', name: 'Alpha', sub: 'Anna Berger, Ben Köhler' },
      { id: 'Beta', name: 'Beta', sub: 'Carla Weiß' },
    ])
  })

  it('has one row per member for a per-user variable, in the slot notation of the form', () => {
    const teams: WizardTeam[] = [
      { name: 'Alpha', members: [member('u1', 'anna'), member('u2', 'ben')] },
      { name: 'Beta', members: [member('u3', 'carla')] },
    ]
    const r = buildRecipients(variable({ osScope: 'user', varScope: 'user' }), teams, nameOf)
    expect(r.kind).toBe('person')
    expect(r.rows.map((x) => x.id)).toEqual(['Alpha-anna', 'Alpha-ben', 'Beta-carla'])
    expect(r.rows[0]).toEqual({ id: 'Alpha-anna', name: 'Anna Berger', sub: 'Alpha' })
    expect(r.rows[2]).toEqual({ id: 'Beta-carla', name: 'Carla Weiß' })
  })

  it('falls back to the username when the name is unknown', () => {
    const teams: WizardTeam[] = [{ name: 'Team #1', members: [member('u9', 'zed')] }]
    expect(buildRecipients(variable(), teams, nameOf).rows[0]!.name).toBe('zed')
  })

  it('has no rows without teams', () => {
    expect(buildRecipients(variable(), [], nameOf).rows).toEqual([])
  })
})

// The card writes files under the ids of its rows; the step drops every other key on "Next".
describe('buildRecipients and fileSlotKeysFor name the same slots', () => {
  const several: WizardTeam[] = [
    { name: 'Alpha', members: [member('u1', 'anna'), member('u2', 'ben')] },
    { name: 'Beta', members: [member('u3', 'carla')] },
  ]
  const eachOne: WizardTeam[] = [
    { name: 'Team #1', members: [member('u1', 'anna')] },
    { name: 'Team #2', members: [member('u2', 'ben')] },
  ]
  const withEmpty: WizardTeam[] = [...several, { name: 'Gamma', members: [] }]

  it.each<['all' | 'team' | 'user', WizardTeam[]]>([
    ['all', several],
    ['all', []],
    ['team', several],
    ['team', eachOne],
    ['team', withEmpty],
    ['team', []],
    ['user', several],
    ['user', eachOne],
    ['user', withEmpty],
    ['user', []],
  ])('scope %s', (scope, teams) => {
    const file = variable({ osScope: scope, varScope: scope })
    expect(fileSlotKeysFor(file, teams)).toEqual(buildRecipients(file, teams, nameOf).rows.map((r) => r.id))
  })
})
