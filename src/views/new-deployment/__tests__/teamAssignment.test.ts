import { describe, it, expect } from 'vitest'
import {
  chooseOneGroup,
  chooseEachUser,
  chooseCustom,
  resizeTeams,
  normalizeTeams,
  moveStudent,
  removeFromTeam,
  shuffleIntoTeams,
  clearAssignments,
  unassignedOf,
  isAssignmentComplete,
  type TeamsState,
} from '../teamAssignment'

const t = (_k: string, o: { index: number }) => `VM-${o.index}`
const students = ['a', 'b', 'c', 'd']

const state = (over: Partial<TeamsState> = {}): TeamsState => ({
  mode: 'custom',
  count: 2,
  assignments: [[], []],
  names: ['Alpha', 'Beta'],
  ...over,
})

describe('modes', () => {
  it('one group puts every student in a single, default-named team', () => {
    const next = chooseOneGroup(state({ names: ['Team 1', 'Beta'] }), students, t)
    expect(next).toEqual({ mode: 'one', count: 1, assignments: [students], names: ['VM-1'] })
  })

  it('one group keeps a custom name', () => {
    expect(chooseOneGroup(state(), students, t).names).toEqual(['Alpha'])
  })

  it('each user creates one default-named team per student', () => {
    const next = chooseEachUser(['a', 'b'], t)
    expect(next).toEqual({ mode: 'eachUser', count: 2, assignments: [['a'], ['b']], names: ['VM-1', 'VM-2'] })
  })

  it('custom starts with two teams when coming from a single one', () => {
    const next = chooseCustom(state({ count: 1, assignments: [['a']], names: ['X'] }), 4, t)
    expect(next.mode).toBe('custom')
    expect(next.count).toBe(2)
    expect(next.names).toEqual(['X', 'VM-2'])
  })

  it('custom keeps the count otherwise', () => {
    expect(chooseCustom(state({ count: 3, assignments: [[], [], []], names: ['a', 'b', 'c'] }), 4, t).count).toBe(3)
  })
})

describe('resizeTeams', () => {
  it('adds empty teams with default names', () => {
    const next = resizeTeams(state(), 3, t)
    expect(next.count).toBe(3)
    expect(next.assignments).toEqual([[], [], []])
    expect(next.names).toEqual(['Alpha', 'Beta', 'VM-3'])
  })

  it('drops removed teams (their students become unassigned)', () => {
    const next = resizeTeams(state({ assignments: [['a'], ['b']] }), 1, t)
    expect(next.assignments).toEqual([['a']])
    expect(next.names).toEqual(['Alpha'])
    expect(unassignedOf(['a', 'b'], next.assignments)).toEqual(['b'])
  })
})

describe('normalizeTeams', () => {
  it('guarantees at least one team, matching arrays and non-blank names', () => {
    const next = normalizeTeams({ mode: 'custom', count: 0, assignments: [], names: [] }, t)
    expect(next).toMatchObject({ count: 1, assignments: [[]], names: ['VM-1'] })

    const padded = normalizeTeams(state({ count: 3, assignments: [['a']], names: ['x', ' '] }), t)
    expect(padded.assignments).toEqual([['a'], [], []])
    expect(padded.names).toEqual(['x', 'VM-2', 'VM-3'])
  })
})

describe('moving students', () => {
  it('moves a student out of any team into the target team', () => {
    expect(moveStudent([['a', 'b'], ['c']], 'a', 1)).toEqual([['b'], ['c', 'a']])
  })

  it('moves a student to the unassigned pool', () => {
    expect(moveStudent([['a', 'b'], ['c']], 'b', null)).toEqual([['a'], ['c']])
  })

  it('does not duplicate a student dropped onto the same team', () => {
    expect(moveStudent([['a']], 'a', 0)).toEqual([['a']])
  })

  it('creates the target team when missing', () => {
    expect(moveStudent([['a']], 'b', 2)).toEqual([['a'], [], ['b']])
  })

  it('removes a student from one team only', () => {
    expect(removeFromTeam([['a', 'b'], ['a']], 'a', 0)).toEqual([['b'], ['a']])
  })
})

describe('shuffleIntoTeams', () => {
  it('distributes all students evenly, earlier teams get the remainder', () => {
    const result = shuffleIntoTeams(['a', 'b', 'c', 'd', 'e'], 2, () => 0)
    expect(result.map((g) => g.length)).toEqual([3, 2])
    expect(result.flat().sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('does not mutate the input', () => {
    const input = ['a', 'b', 'c']
    shuffleIntoTeams(input, 2, Math.random)
    expect(input).toEqual(['a', 'b', 'c'])
  })
})

describe('helpers', () => {
  it('clears all assignments but keeps the team count', () => {
    expect(clearAssignments(3)).toEqual([[], [], []])
  })

  it('lists unassigned students in input order', () => {
    expect(unassignedOf(['a', 'b', 'c'], [['b']])).toEqual(['a', 'c'])
  })

  it('is complete when nobody is unassigned and every team has a student and a name', () => {
    expect(isAssignmentComplete(['a', 'b'], state({ assignments: [['a'], ['b']] }))).toBe(true)
    expect(isAssignmentComplete(['a', 'b'], state({ assignments: [['a'], []] }))).toBe(false)
    expect(isAssignmentComplete(['a', 'b'], state({ assignments: [['a', 'b'], []] }))).toBe(false)
    expect(isAssignmentComplete(['a', 'b'], state({ assignments: [['a'], ['b']], names: ['x', ' '] }))).toBe(false)
  })
})
