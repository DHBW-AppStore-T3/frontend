import { describe, it, expect } from 'vitest'
import {
  isExpert,
  displayDescription,
  effectiveScope,
  isScoped,
  buildWizardTeams,
  userSlotKey,
  slotKeysFor,
  formatSlotLabel,
  seedScopedDefault,
  dedupeVariables,
  restoreFromDraft,
  initialFromFetch,
  normalizeValue,
  buildDraftValues,
  findMissingRequired,
  dropStaleSlots,
  hasBlockingExpert,
  type WizardTeam,
} from '../variableForm'

const v = (over: Record<string, unknown> = {}) => ({ name: 'x', type: 'string', source: 'terraform', ...over }) as any
const teams: WizardTeam[] = [
  { name: 'Alpha', members: [{ userId: 'u1', username: 'ann' }, { userId: 'u2', username: 'bob' }] },
  { name: 'Beta', members: [{ userId: 'u3', username: 'cy' }] },
]

describe('flags', () => {
  it('detects @expert and strips the marker from the description', () => {
    expect(isExpert(v({ description: 'tune this @expert' }))).toBe(true)
    expect(isExpert(v({}))).toBe(false)
    expect(displayDescription(v({ description: 'tune this @expert' }))).toBe('tune this')
    expect(displayDescription(v({}))).toBe('')
  })

  it('prefers varScope over osScope and defaults to all', () => {
    expect(effectiveScope(v({ varScope: 'team', osScope: 'user' }))).toBe('team')
    expect(effectiveScope(v({ osScope: 'user' }))).toBe('user')
    expect(effectiveScope(v())).toBe('all')
    expect(isScoped(v({ varScope: 'user' }))).toBe(true)
    expect(isScoped(v())).toBe(false)
  })
})

describe('teams & slots', () => {
  it('builds wizard teams from draft names/assignments and the student cache', () => {
    const cache = new Map<string, any>([
      ['u1', { username: 'ann' }],
      ['u2', { email: 'bob@x.de' }],
      ['u3', { firstName: 'Cy' }],
    ])
    expect(buildWizardTeams(['Alpha', ''], [['u1', 'u2'], ['u3', 'zzzzzzzzzzzz']], cache)).toEqual([
      { name: 'Alpha', members: [{ userId: 'u1', username: 'ann' }, { userId: 'u2', username: 'bob' }] },
      { name: 'Team-2', members: [{ userId: 'u3', username: 'Cy' }, { userId: 'zzzzzzzzzzzz', username: 'zzzzzzzz' }] },
    ])
  })

  it('derives slot keys per scope', () => {
    expect(slotKeysFor(v({ varScope: 'team' }), teams)).toEqual(['Alpha', 'Beta'])
    expect(slotKeysFor(v({ varScope: 'user' }), teams)).toEqual(['Alpha-ann', 'Alpha-bob', 'Beta-cy'])
    expect(slotKeysFor(v(), teams)).toEqual([])
    expect(userSlotKey('Alpha', 'ann')).toBe('Alpha-ann')
  })

  it('labels slots, resolving team names containing dashes first', () => {
    const dashed: WizardTeam[] = [{ name: 'A', members: [] }, { name: 'A-B', members: [] }]
    expect(formatSlotLabel(v({ varScope: 'team' }), 'Alpha', teams)).toBe('Team „Alpha"')
    expect(formatSlotLabel(v({ varScope: 'user' }), 'Alpha-ann', teams)).toBe('Team „Alpha" → ann')
    expect(formatSlotLabel(v({ varScope: 'user' }), 'A-B-cy', dashed)).toBe('Team „A-B" → cy')
    expect(formatSlotLabel(v({ varScope: 'user' }), 'Gone-zed', teams)).toBe('Team „Gone" → zed')
  })
})

describe('seedScopedDefault', () => {
  it('distributes a scalar default over all slots without overwriting existing values', () => {
    const def = v({ varScope: 'team', default: 'small' })
    expect(seedScopedDefault(def, { Alpha: 'big' }, teams)).toEqual({ Alpha: 'big', Beta: 'small' })
  })

  it('joins list defaults to a comma string', () => {
    expect(seedScopedDefault(v({ varScope: 'team', type: 'list(string)', default: ['a', 'b'] }), undefined, teams)).toEqual({
      Alpha: 'a, b',
      Beta: 'a, b',
    })
  })

  it('leaves object defaults and missing defaults as the existing map', () => {
    expect(seedScopedDefault(v({ varScope: 'team', default: {} }), undefined, teams)).toEqual({})
    expect(seedScopedDefault(v({ varScope: 'team' }), { Alpha: 1 }, teams)).toEqual({ Alpha: 1 })
  })
})

describe('dedupeVariables', () => {
  it('removes duplicate definitions (same name)', () => {
    const a = v({ name: 'a' })
    expect(dedupeVariables([a, { ...a, description: 'second' }, v({ name: 't' })] as any)).toHaveLength(2)
  })
})

describe('restoreFromDraft', () => {
  it('restores flat and scoped values and fills defaults', () => {
    const defs = [
      v({ name: 'flat', default: 'd' }),
      v({ name: 'lst', type: 'list(string)' }),
      v({ name: 'sc', varScope: 'team', default: 's' }),
      v({ name: 'file', osType: 'file' }),
    ]
    const stored = { lst: ['a', 'b'], sc: { Alpha: 'x' } }
    const values = restoreFromDraft(defs, stored, teams)

    expect(values).toEqual({ flat: 'd', lst: 'a, b', sc: { Alpha: 'x', Beta: 's' } })
  })
})

describe('initialFromFetch', () => {
  it('prefers saved values by form key, then name, then default; bools default to false', () => {
    const defs = [
      v({ name: 'a', default: 'da' }),
      v({ name: 'b', default: 'db' }),
      v({ name: 'flag', type: 'bool' }),
      v({ name: 'lst', type: 'list(string)', default: ['x', 'y'] }),
    ]
    const values = initialFromFetch(defs, { a: 'saved' }, [])
    expect(values).toEqual({ a: 'saved', b: 'db', flag: false, lst: 'x, y' })
  })
})

describe('normalizeValue', () => {
  it('normalises by type for comparison', () => {
    expect(normalizeValue(null, 'list(string)')).toEqual([])
    expect(normalizeValue('b, a', 'list(string)')).toBe(JSON.stringify(['a', 'b']))
    expect(normalizeValue('', 'number')).toBeNull()
    expect(normalizeValue('5', 'number')).toBe(5)
    expect(normalizeValue(undefined, 'bool')).toBe(false)
    expect(normalizeValue(' x ', 'string')).toBe('x')
  })
})

describe('buildDraftValues', () => {
  it('saves changed values separately from all values and coerces types', () => {
    const defs = [
      v({ name: 'same', default: 'a' }),
      v({ name: 'changed', default: 'a' }),
      v({ name: 'n', type: 'number', default: 1 }),
      v({ name: 'l', type: 'list(string)', default: [] }),
      v({ name: 'file', osType: 'file' }),
    ]
    const { changed, all } = buildDraftValues(
      defs,
      { same: 'a', changed: 'b', n: '3', l: 'x, y' },
    )
    expect(changed).toEqual({ changed: 'b', n: 3, l: ['x', 'y'] })
    expect(all).toEqual({ same: 'a', changed: 'b', n: 3, l: ['x', 'y'] })
  })

  it('drops empty slots of scoped variables and coerces slot values', () => {
    const defs = [v({ name: 'sc', varScope: 'team', type: 'number' })]
    const { changed, all } = buildDraftValues(defs, { sc: { Alpha: '2', Beta: '' } })
    expect(changed).toEqual({ sc: { Alpha: 2 } })
    expect(all).toEqual({ sc: { Alpha: 2 } })
  })

  it('keeps an empty scoped map in all-values but out of the changed ones', () => {
    const { changed, all } = buildDraftValues([v({ name: 'sc', varScope: 'team' })], { sc: {} })
    expect(changed).toEqual({})
    expect(all).toEqual({ sc: {} })
  })
})

describe('findMissingRequired', () => {
  it('reports empty required scalars and empty slots, ignoring files and optional ones', () => {
    const defs = [
      v({ name: 'req', required: true }),
      v({ name: 'ok', required: true }),
      v({ name: 'opt' }),
      v({ name: 'file', required: true, osType: 'file' }),
      v({ name: 'sc', required: true, varScope: 'team' }),
    ]
    const missing = findMissingRequired(defs, { req: ' ', ok: 'x', sc: { Alpha: 'v' } }, teams)
    expect(missing).toEqual(['req', 'sc (Beta)'])
  })

  it('reports a scoped required variable when there are no slots at all', () => {
    expect(findMissingRequired([v({ name: 'sc', required: true, varScope: 'team' })], {}, [])).toEqual(['sc'])
  })
})

describe('dropStaleSlots', () => {
  it('removes slots that no longer exist and lists them', () => {
    const defs = [v({ name: 'sc', varScope: 'team' })]
    const result = dropStaleSlots(defs, { sc: { Alpha: '1', Gone: '2' } }, teams)
    expect(result.values).toEqual({ sc: { Alpha: '1' } })
    expect(result.dropped).toEqual(['sc → Gone'])
  })

  it('returns the same object when nothing was dropped', () => {
    const values = { sc: { Alpha: '1' } }
    const result = dropStaleSlots([v({ name: 'sc', varScope: 'team' })], values, teams)
    expect(result.values).toBe(values)
    expect(result.dropped).toEqual([])
  })
})

describe('expert helpers', () => {
  it('blocks (opens the expert accordion) for required expert vars without default', () => {
    expect(hasBlockingExpert([v({ description: '@expert', required: true })])).toBe(true)
    expect(hasBlockingExpert([v({ description: '@expert', required: true, default: 'x' })])).toBe(false)
    expect(hasBlockingExpert([v({ required: true })])).toBe(false)
  })
})
