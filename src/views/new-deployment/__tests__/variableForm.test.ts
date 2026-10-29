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
  dropStaleFileSlots,
  fileSlotKeysFor,
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

describe('fileSlotKeysFor', () => {
  const file = (over: Record<string, unknown> = {}) => v({ name: 'f', osType: 'file', ...over })

  it('has the one key "all" for a deployment-wide file, whatever the teams are', () => {
    expect(fileSlotKeysFor(file({ varScope: 'all' }), teams)).toEqual(['all'])
    expect(fileSlotKeysFor(file({ varScope: 'all' }), [])).toEqual(['all'])
    expect(fileSlotKeysFor(file(), teams)).toEqual(['all'])
  })

  it('has one key per team or per person otherwise, like the slots of a plain variable', () => {
    expect(fileSlotKeysFor(file({ varScope: 'team' }), teams)).toEqual(['Alpha', 'Beta'])
    expect(fileSlotKeysFor(file({ varScope: 'user' }), teams)).toEqual(['Alpha-ann', 'Alpha-bob', 'Beta-cy'])
    expect(fileSlotKeysFor(file({ varScope: 'team' }), [])).toEqual([])
  })

  it('reads the scope like the card: varScope before osScope', () => {
    expect(fileSlotKeysFor(file({ osScope: 'team' }), teams)).toEqual(['Alpha', 'Beta'])
    expect(fileSlotKeysFor(file({ varScope: 'user', osScope: 'team' }), teams)).toEqual([
      'Alpha-ann',
      'Alpha-bob',
      'Beta-cy',
    ])
  })
})

describe('dropStaleFileSlots', () => {
  const upload = (name: string) => ({ name, size: 1, content_b64: 'eA==', content_type: 'text/plain' })
  const starter = v({ name: 'starter', osType: 'file', varScope: 'user' })
  const handout = v({ name: 'handout', osType: 'file', varScope: 'team' })
  const syllabus = v({ name: 'syllabus', osType: 'file', varScope: 'all' })
  const defs = [starter, handout, syllabus]

  it('removes the files of people, teams and keys that no longer exist, and lists them', () => {
    const uploads = {
      starter: { 'Alpha-ann': upload('a'), 'Alpha-gone': upload('b'), 'Beta-cy': upload('c'), 'Old-cy': upload('d') },
      handout: { Alpha: upload('e'), Gone: upload('f') },
      syllabus: { all: upload('g'), Alpha: upload('h') },
    }
    const result = dropStaleFileSlots(defs, uploads, teams)
    expect(result.uploads).toEqual({
      starter: { 'Alpha-ann': upload('a'), 'Beta-cy': upload('c') },
      handout: { Alpha: upload('e') },
      syllabus: { all: upload('g') },
    })
    expect(result.dropped).toEqual([
      'starter → Alpha-gone',
      'starter → Old-cy',
      'handout → Gone',
      'syllabus → Alpha',
    ])
  })

  it('keeps the variable with an empty map when all its files are gone', () => {
    const result = dropStaleFileSlots(defs, { handout: { Gone: upload('f') } }, teams)
    expect(result.uploads).toEqual({ handout: {} })
  })

  it('returns the same object when nothing was dropped', () => {
    const uploads = { starter: { 'Alpha-ann': upload('a') }, syllabus: { all: upload('g') } }
    const result = dropStaleFileSlots(defs, uploads, teams)
    expect(result.uploads).toBe(uploads)
    expect(result.dropped).toEqual([])
  })

  it('does not change the input', () => {
    const uploads = { handout: { Alpha: upload('e'), Gone: upload('f') } }
    const copy = JSON.parse(JSON.stringify(uploads))
    dropStaleFileSlots(defs, uploads, teams)
    expect(uploads).toEqual(copy)
  })

  it('leaves entries alone that belong to no file variable of the app', () => {
    const plain = v({ name: 'plain', varScope: 'team' })
    const uploads = { unknown: { Gone: upload('x') }, plain: { Gone: upload('y') } }
    const result = dropStaleFileSlots([...defs, plain], uploads, teams)
    expect(result.uploads).toBe(uploads)
    expect(result.dropped).toEqual([])
  })

  it('handles missing uploads and an empty team list', () => {
    expect(dropStaleFileSlots(defs, undefined, teams)).toEqual({ uploads: undefined, dropped: [] })
    const result = dropStaleFileSlots(defs, { handout: { Alpha: upload('e') }, syllabus: { all: upload('g') } }, [])
    expect(result.uploads).toEqual({ handout: {}, syllabus: { all: upload('g') } })
  })
})

describe('expert helpers', () => {
  it('blocks (opens the expert accordion) for required expert vars without default', () => {
    expect(hasBlockingExpert([v({ description: '@expert', required: true })])).toBe(true)
    expect(hasBlockingExpert([v({ description: '@expert', required: true, default: 'x' })])).toBe(false)
    expect(hasBlockingExpert([v({ required: true })])).toBe(false)
  })
})

// ====================================================================
// Characterization tests (frontend#88)
//
// Written by hand against the code BEFORE the any -> explicit types refactor and
// kept unchanged afterwards. They pin what the functions do today, including
// results that look like quirks (marked "quirk"); none of them is a fix.
// ====================================================================

const teamVar = (name: string, over: Record<string, unknown> = {}) => v({ name, varScope: 'team', ...over })
const userVar = (name: string, over: Record<string, unknown> = {}) => v({ name, varScope: 'user', ...over })

describe('characterization: dropStaleSlots', () => {
  it('drops the slots of several renamed teams across variables, in key order', () => {
    const defs = [teamVar('a'), teamVar('b')]
    const form = { a: { Alpha: '1', Old1: '2', Old2: '3' }, b: { Beta: 'x', Gone: 'y' } }

    const { values, dropped } = dropStaleSlots(defs, form, teams)

    expect(values).toEqual({ a: { Alpha: '1' }, b: { Beta: 'x' } })
    expect(dropped).toEqual(['a → Old1', 'a → Old2', 'b → Gone'])
  })

  it('handles user slots: only team-username keys of existing members survive', () => {
    const form = { u: { 'Alpha-ann': '1', 'Alpha-zed': '2', 'Gamma-cy': '3', 'Beta-cy': '4' } }

    const { values, dropped } = dropStaleSlots([userVar('u')], form, teams)

    expect(values).toEqual({ u: { 'Alpha-ann': '1', 'Beta-cy': '4' } })
    expect(dropped).toEqual(['u → Alpha-zed', 'u → Gamma-cy'])
  })

  it('drops every slot when there are no teams left', () => {
    const { values, dropped } = dropStaleSlots([teamVar('a')], { a: { Alpha: '1' } }, [])
    expect(values).toEqual({ a: {} })
    expect(dropped).toEqual(['a → Alpha'])
  })

  it('skips values that are not plain maps (string, array, null, missing)', () => {
    const defs = [teamVar('s'), teamVar('arr'), teamVar('n'), teamVar('missing')]
    const form = { s: 'text', arr: ['Old'], n: null }

    const result = dropStaleSlots(defs, form, teams)

    expect(result.values).toBe(form)
    expect(result.dropped).toEqual([])
  })

  it('ignores unscoped and file variables even when they hold a map', () => {
    const defs = [v({ name: 'plain' }), teamVar('f', { osType: 'file' })]
    const form = { plain: { Old: '1' }, f: { Old: '2' } }

    const result = dropStaleSlots(defs, form, teams)

    expect(result.values).toBe(form)
    expect(result.dropped).toEqual([])
  })

  it('returns the same object when nothing is stale, and a copy only when something is', () => {
    const defs = [teamVar('a'), teamVar('b')]
    const clean = { a: { Alpha: '1' }, b: { Beta: '2' } }
    expect(dropStaleSlots(defs, clean, teams).values).toBe(clean)

    const form = { a: { Alpha: '1', Old: '2' }, b: clean.b }
    const { values } = dropStaleSlots(defs, form, teams)
    expect(values).not.toBe(form)
    expect(values.b).toBe(form.b) // untouched entries keep their identity
    expect(form.a).toEqual({ Alpha: '1', Old: '2' }) // the input is not mutated
  })
})

describe('characterization: @expert marker', () => {
  it.each([
    ['@expert only for experts', 'only for experts'],
    ['Foo @expert bar', 'Foo  bar'], // quirk: the gap is not collapsed
    ['Foo bar @expert', 'Foo bar'],
    ['@expert a @expert', 'a'],
    ['@expert, then text', ', then text'],
    ['@expert', ''],
  ])('strips the marker from %j', (description, shown) => {
    expect(isExpert(v({ description }))).toBe(true)
    expect(displayDescription(v({ description }))).toBe(shown)
  })

  it('quirk: "@expertise" counts as expert but the text keeps the word', () => {
    expect(isExpert(v({ description: 'ask an @expertise group' }))).toBe(true)
    expect(displayDescription(v({ description: 'ask an @expertise group' }))).toBe('ask an @expertise group')
  })

  it('is not expert without a description or without the marker', () => {
    expect(isExpert(v())).toBe(false)
    expect(isExpert(v({ description: '' }))).toBe(false)
    expect(isExpert(v({ description: 'expert' }))).toBe(false)
    expect(displayDescription(v())).toBe('')
    expect(displayDescription(v({ description: '  plain  ' }))).toBe('plain')
  })

  describe('hasBlockingExpert: expert, required and default combinations', () => {
    const blocking = (over: Record<string, unknown>) =>
      hasBlockingExpert([v({ description: '@expert x', required: true, ...over })])

    it('blocks for a required expert variable without default', () => {
      expect(blocking({})).toBe(true)
      expect(blocking({ default: null })).toBe(true)
      expect(blocking({ default: undefined })).toBe(true)
    })

    it.each([[''], [0], [false], ['x'], [[]], [{}]])('does not block when the default is %j', (def) => {
      expect(blocking({ default: def })).toBe(false)
    })

    it('does not block when the variable is not required, not expert, or required is unset', () => {
      expect(blocking({ required: false })).toBe(false)
      expect(blocking({ required: undefined })).toBe(false)
      expect(hasBlockingExpert([v({ description: 'plain', required: true })])).toBe(false)
      expect(hasBlockingExpert([])).toBe(false)
    })

    it('blocks as soon as one of several variables qualifies', () => {
      const defs = [
        v({ name: 'a', description: '@expert', required: true, default: 'x' }),
        v({ name: 'b', description: '@expert', required: true }),
      ]
      expect(hasBlockingExpert(defs)).toBe(true)
    })
  })
})

describe('characterization: empty-ish values', () => {
  const missingFor = (value: unknown) => findMissingRequired([v({ required: true })], { x: value }, teams)

  it.each([[undefined], [null], [''], ['   '], ['\t\n'], [[]]])('treats %j as missing for a required variable', (value) => {
    expect(missingFor(value)).toEqual(['x'])
  })

  it.each([[0], [false], ['0'], ['false'], [['']], [{}], [' a ']])('treats %j as filled in', (value) => {
    expect(missingFor(value)).toEqual([])
  })

  it('reads a missing key like undefined', () => {
    expect(findMissingRequired([v({ required: true })], {}, teams)).toEqual(['x'])
  })

  it('applies the same test to every slot of a scoped variable', () => {
    const form = { x: { Alpha: 0, Beta: false } }
    expect(findMissingRequired([teamVar('x', { required: true })], form, teams)).toEqual([])
    const empty = { x: { Alpha: '  ', Beta: [] } }
    expect(findMissingRequired([teamVar('x', { required: true })], empty, teams)).toEqual(['x (Alpha)', 'x (Beta)'])
  })

  it('reports a scoped variable with a missing map once per empty slot', () => {
    expect(findMissingRequired([teamVar('x', { required: true })], {}, teams)).toEqual(['x (Alpha)', 'x (Beta)'])
  })
})

describe('characterization: normalizeValue by type', () => {
  const vals: unknown[] = [undefined, null, '', '  ', 0, false, [], {}]

  it('string: null-ish become "" and everything else is String()-trimmed', () => {
    expect(vals.map((x) => normalizeValue(x, 'string'))).toEqual(['', '', '', '', '0', 'false', '', '[object Object]'])
    expect(normalizeValue('  hi ', 'string')).toBe('hi')
    expect(normalizeValue(true, 'string')).toBe('true')
  })

  it('number: null-ish give "", "" gives null, the rest Number()', () => {
    expect(normalizeValue(undefined, 'number')).toBe('')
    expect(normalizeValue(null, 'number')).toBe('')
    expect(normalizeValue('', 'number')).toBeNull()
    expect(normalizeValue('  ', 'number')).toBe(0) // quirk: whitespace is 0
    expect(normalizeValue('5', 'integer')).toBe(5)
    expect(normalizeValue(0, 'number')).toBe(0)
    expect(normalizeValue(false, 'number')).toBe(0)
    expect(normalizeValue([], 'number')).toBe(0)
    expect(normalizeValue({}, 'number')).toBeNaN()
    expect(normalizeValue('abc', 'number')).toBeNaN()
  })

  it('bool: Boolean() of the value, null-ish are false', () => {
    expect(vals.map((x) => normalizeValue(x, 'bool'))).toEqual([false, false, false, true, false, false, true, true])
    expect(normalizeValue('false', 'boolean')).toBe(true) // quirk: any non-empty string
    expect(normalizeValue(1, 'bool')).toBe(true)
  })

  it('list: sorted JSON of the entries; strings are split on commas', () => {
    expect(normalizeValue(['b', 'a'], 'list(string)')).toBe('["a","b"]')
    expect(normalizeValue('b, a,, ', 'list(string)')).toBe('["a","b"]')
    expect(normalizeValue('', 'list')).toBe('[]')
    expect(normalizeValue('  ', 'set(string)')).toBe('[]')
    expect(normalizeValue([], 'list')).toBe('[]')
    expect(normalizeValue(0, 'list')).toBe('["0"]')
    expect(normalizeValue(false, 'list')).toBe('["false"]')
    expect(normalizeValue({}, 'list')).toBe('["[object Object]"]')
  })

  it('list: entries sort as strings, numbers stay numbers in the JSON', () => {
    expect(normalizeValue([10, 9], 'list(number)')).toBe('[10,9]')
  })

  it('quirk: a null-ish list is a new empty ARRAY, so two of them never compare equal', () => {
    const a = normalizeValue(null, 'list(string)')
    const b = normalizeValue(undefined, 'list(string)')
    expect(a).toEqual([])
    expect(a).not.toBe(b)
  })

  it('map and other types go through String(): all objects look alike', () => {
    expect(normalizeValue({ a: 1 }, 'map(string)')).toBe('[object Object]')
    expect(normalizeValue({ b: 2 }, 'map(string)')).toBe('[object Object]')
    expect(normalizeValue(null, 'map(string)')).toBe('')
  })
})

describe('characterization: seedScopedDefault', () => {
  it('seeds empty slots (undefined, null, "") but keeps 0, false and text', () => {
    const existing = { Alpha: '', Beta: null }
    expect(seedScopedDefault(teamVar('t', { default: 'd' }), existing, teams)).toEqual({ Alpha: 'd', Beta: 'd' })

    const kept = { Alpha: 0, Beta: false }
    expect(seedScopedDefault(teamVar('t', { default: 'd' }), kept, teams)).toEqual({ Alpha: 0, Beta: false })
  })

  it.each([[0], [false], [''], [7], [true]])('spreads the scalar default %j over every slot', (def) => {
    expect(seedScopedDefault(teamVar('t', { default: def }), undefined, teams)).toEqual({ Alpha: def, Beta: def })
  })

  it('seeds one slot per team member for user scope', () => {
    expect(seedScopedDefault(userVar('u', { default: 'd' }), undefined, teams)).toEqual({
      'Alpha-ann': 'd',
      'Alpha-bob': 'd',
      'Beta-cy': 'd',
    })
  })

  it('joins an array default of a list type, and shares the array otherwise', () => {
    expect(seedScopedDefault(teamVar('t', { type: 'list(string)', default: ['a', 'b'] }), undefined, teams)).toEqual({
      Alpha: 'a, b',
      Beta: 'a, b',
    })
    expect(seedScopedDefault(teamVar('t', { type: 'list(string)', default: [] }), undefined, teams)).toEqual({
      Alpha: '',
      Beta: '',
    })

    const def = ['a']
    const map = seedScopedDefault(teamVar('t', { type: 'string', default: def }), undefined, teams)
    expect(map.Alpha).toBe(def)
    expect(map.Beta).toBe(def)
  })

  it('keeps a scalar default of a list type as it is', () => {
    expect(seedScopedDefault(teamVar('t', { type: 'list(string)', default: 'solo' }), undefined, teams)).toEqual({
      Alpha: 'solo',
      Beta: 'solo',
    })
  })

  it('seeds nothing for object, null or missing defaults, but still returns a copy', () => {
    const existing = { Alpha: 'keep' }
    for (const def of [{ a: 1 }, null, undefined]) {
      const out = seedScopedDefault(teamVar('t', { default: def }), existing, teams)
      expect(out).toEqual({ Alpha: 'keep' })
      expect(out).not.toBe(existing)
    }
  })

  it('treats an existing value that is not a plain map as no value at all', () => {
    for (const bad of ['text', ['Alpha'], null, 5]) {
      expect(seedScopedDefault(teamVar('t', { default: 'd' }), bad as never, teams)).toEqual({ Alpha: 'd', Beta: 'd' })
    }
  })

  it('keeps stale slots and only seeds slots that appeared (team added after going back)', () => {
    const existing = { Alpha: 'mine', Vanished: 'old' }
    expect(seedScopedDefault(teamVar('t', { default: 'd' }), existing, teams)).toEqual({
      Alpha: 'mine',
      Vanished: 'old',
      Beta: 'd',
    })
  })
})

describe('characterization: restoreFromDraft', () => {
  it('uses the stored value over the default, including "", 0 and false', () => {
    const defs = [
      v({ name: 'a', default: 'dflt' }),
      v({ name: 'b', default: 5, type: 'number' }),
      v({ name: 'c', default: true, type: 'bool' }),
    ]
    expect(restoreFromDraft(defs, { a: '', b: 0, c: false }, teams)).toEqual({ a: '', b: 0, c: false })
  })

  it('falls back to the default for null and undefined, and to "" without a default', () => {
    const defs = [
      v({ name: 'a', default: 'dflt' }),
      v({ name: 'b', default: 'dflt' }),
      v({ name: 'c' }),
      v({ name: 'd', default: null }),
    ]
    expect(restoreFromDraft(defs, { a: null, b: undefined }, teams)).toEqual({ a: 'dflt', b: 'dflt', c: '', d: '' })
  })

  it('quirk: a bool without stored value or default restores as "", not false', () => {
    expect(restoreFromDraft([v({ name: 'flag', type: 'bool' })], {}, teams)).toEqual({ flag: '' })
  })

  it('shows lists as comma text, whether stored or default; empty list is ""', () => {
    const defs = [
      v({ name: 'stored', type: 'list(string)' }),
      v({ name: 'dflt', type: 'list(string)', default: ['x', 'y'] }),
      v({ name: 'empty', type: 'list(string)' }),
      v({ name: 'blanks', type: 'list(string)' }),
    ]
    const stored = { stored: ['a', 'b'], empty: [], blanks: ['a', '', 'b'] }
    expect(restoreFromDraft(defs, stored, teams)).toEqual({ stored: 'a, b', dflt: 'x, y', empty: '', blanks: 'a, , b' })
  })

  it('leaves an array for a non-list type as it is (same reference) and does not touch the input', () => {
    const arr = ['a']
    const stored = { x: arr }
    const out = restoreFromDraft([v({ type: 'string' })], stored, teams)
    expect(out.x).toBe(arr)
    expect(stored).toEqual({ x: ['a'] })
  })

  it('keeps a text stored for a list type as text', () => {
    expect(restoreFromDraft([v({ type: 'list(string)' })], { x: 'a, b' }, teams)).toEqual({ x: 'a, b' })
  })

  it('skips file variables (they travel through draft.fileUploads)', () => {
    expect(restoreFromDraft([v({ name: 'f', osType: 'file' }), v({ name: 'g' })], { f: 'ignored' }, teams)).toEqual({ g: '' })
  })

  it('returns to a scoped variable: keeps stored slots, seeds new ones, copies the map', () => {
    const stored = { t: { Alpha: 'mine' } }
    const out = restoreFromDraft([teamVar('t', { default: 'd' })], stored, teams)
    expect(out).toEqual({ t: { Alpha: 'mine', Beta: 'd' } })
    expect(out.t).not.toBe(stored.t)
    expect(stored.t).toEqual({ Alpha: 'mine' })
  })

  it('seeds a scoped variable from its default when nothing or a non-map is stored', () => {
    const def = teamVar('t', { default: 'd' })
    expect(restoreFromDraft([def], {}, teams)).toEqual({ t: { Alpha: 'd', Beta: 'd' } })
    expect(restoreFromDraft([def], { t: 'junk' }, teams)).toEqual({ t: { Alpha: 'd', Beta: 'd' } })
  })

  it('quirk: list slots stored as arrays come back as arrays, not as comma text', () => {
    const def = teamVar('t', { type: 'list(string)' })
    expect(restoreFromDraft([def], { t: { Alpha: ['a', 'b'] } }, teams).t).toEqual({ Alpha: ['a', 'b'] })
  })
})

describe('characterization: initialFromFetch', () => {
  it('takes a saved value of any kind, even null, "", 0 and false, before the default', () => {
    const defs = [
      v({ name: 'a', default: 'dflt' }),
      v({ name: 'b', default: 'dflt' }),
      v({ name: 'c', default: 9, type: 'number' }),
      v({ name: 'd', default: 'dflt' }),
    ]
    expect(initialFromFetch(defs, { a: '', b: null, c: 0, d: false }, teams)).toEqual({ a: '', b: '', c: 0, d: false })
  })

  it('uses the default when nothing is saved: 0, false and "" count, null does not', () => {
    const defs = [
      v({ name: 'n', type: 'number', default: 0 }),
      v({ name: 'b', type: 'bool', default: false }),
      v({ name: 's', default: '' }),
      v({ name: 'z', default: null }),
    ]
    expect(initialFromFetch(defs, {}, teams)).toEqual({ n: 0, b: false, s: '', z: '' })
  })

  it('an unset bool is false, an unset anything else is ""; a saved empty bool is false', () => {
    const defs = [
      v({ name: 'f', type: 'bool' }),
      v({ name: 'g', type: 'bool' }),
      v({ name: 'h', type: 'bool' }),
      v({ name: 's' }),
    ]
    expect(initialFromFetch(defs, { g: '', h: null }, teams)).toEqual({ f: false, g: false, h: false, s: '' })
  })

  it('shows list values as comma text, saved or default', () => {
    const defs = [v({ name: 'a', type: 'list(string)' }), v({ name: 'b', type: 'list(string)', default: ['p', 'q'] })]
    expect(initialFromFetch(defs, { a: ['x', '', 'y'] }, teams)).toEqual({ a: 'x, , y', b: 'p, q' })
    expect(initialFromFetch([v({ type: 'list(string)', default: [] })], {}, teams)).toEqual({ x: '' })
  })

  it('keeps a saved map of an unscoped variable and arrays of other types', () => {
    const map = { k: 'v' }
    const defs = [v({ name: 'm', type: 'map(string)' }), v({ name: 'n', type: 'string' })]
    const out = initialFromFetch(defs, { m: map, n: ['a'] }, teams)
    expect(out.m).toBe(map)
    expect(out.n).toEqual(['a'])
  })

  it('seeds scoped variables from the saved map or the default', () => {
    const def = teamVar('t', { default: 'd' })
    expect(initialFromFetch([def], { t: { Alpha: 'saved' } }, teams)).toEqual({ t: { Alpha: 'saved', Beta: 'd' } })
    expect(initialFromFetch([def], {}, teams)).toEqual({ t: { Alpha: 'd', Beta: 'd' } })
    expect(initialFromFetch([def], { t: 'junk' }, teams)).toEqual({ t: { Alpha: 'd', Beta: 'd' } })
  })

  it('quirk: unlike restoreFromDraft it does not skip file variables', () => {
    const defs = [v({ name: 'f', osType: 'file' }), teamVar('g', { osType: 'file' })]
    expect(initialFromFetch(defs, {}, teams)).toEqual({ f: '', g: '' })
  })
})

describe('characterization: buildDraftValues', () => {
  it('omits file variables from changed and all', () => {
    const defs = [v({ name: 'f', osType: 'file' }), teamVar('g', { osType: 'file' }), v({ name: 'a', default: 'x' })]
    const { changed, all } = buildDraftValues(defs, { f: 'whatever', g: { Alpha: 'z' }, a: 'y' })
    expect(Object.keys(all)).toEqual(['a'])
    expect(changed).toEqual({ a: 'y' })
  })

  it('splits lists on commas, drops empty entries, keeps order, and leaves arrays alone', () => {
    const defs = [
      v({ name: 'a', type: 'list(string)' }),
      v({ name: 'b', type: 'list(string)' }),
      v({ name: 'c', type: 'list(string)' }),
    ]
    const { all } = buildDraftValues(defs, { a: 'x, y,, z ,', b: '', c: ['q', ''] })
    expect(all).toEqual({ a: ['x', 'y', 'z'], b: [], c: ['q', ''] })
  })

  it('does not count a differently ordered list as changed, but stores the form order', () => {
    const defs = [v({ name: 'l', type: 'list(string)', default: ['a', 'b'] })]
    const { changed, all } = buildDraftValues(defs, { l: 'b, a' })
    expect(changed).toEqual({})
    expect(all).toEqual({ l: ['b', 'a'] })
  })

  it('quirk: a list without default is always "changed", even when empty', () => {
    const { changed, all } = buildDraftValues([v({ name: 'l', type: 'list(string)' })], { l: '' })
    expect(changed).toEqual({ l: [] })
    expect(all).toEqual({ l: [] })
  })

  it('stores numbers as numbers, "" as "", and compares numerically', () => {
    const defs = [
      v({ name: 'a', type: 'number', default: 5 }),
      v({ name: 'b', type: 'number', default: 5 }),
      v({ name: 'c', type: 'number' }),
      v({ name: 'z', type: 'number', default: 0 }),
    ]
    const { changed, all } = buildDraftValues(defs, { a: '5', b: '6.5', c: '', z: 0 })
    expect(all).toEqual({ a: 5, b: 6.5, c: '', z: 0 })
    // quirk: an empty number without default normalizes to null (form) vs "" (default), so it counts as changed
    expect(changed).toEqual({ b: 6.5, c: '' })
  })

  it('quirk: a missing number key is stored as NaN and counts as changed', () => {
    const { changed, all } = buildDraftValues([v({ name: 'n', type: 'number', default: 5 })], {})
    expect(all.n).toBeNaN()
    expect(Object.keys(changed)).toEqual(['n'])
    expect(JSON.stringify(changed)).toBe('{"n":null}')
  })

  it('stores booleans as given (no coercion) and compares them as Boolean', () => {
    const defs = [
      v({ name: 'a', type: 'bool', default: true }),
      v({ name: 'b', type: 'bool', default: false }),
      v({ name: 'c', type: 'bool', default: true }),
    ]
    const { changed, all } = buildDraftValues(defs, { a: true, b: true, c: 'true' })
    expect(all).toEqual({ a: true, b: true, c: 'true' })
    expect(changed).toEqual({ b: true })
  })

  it('stores strings untrimmed but compares them trimmed', () => {
    const defs = [v({ name: 'a', default: 'hi' }), v({ name: 'b', default: 'hi' })]
    const { changed, all } = buildDraftValues(defs, { a: '  hi ', b: ' ho ' })
    expect(all).toEqual({ a: '  hi ', b: ' ho ' })
    expect(changed).toEqual({ b: ' ho ' })
  })

  it('stores a missing string value as undefined, an empty one as ""', () => {
    const defs = [v({ name: 'a', default: 'dflt' }), v({ name: 'b', default: 'dflt' })]
    const { changed, all } = buildDraftValues(defs, { b: '' })
    expect(all.a).toBeUndefined()
    expect(Object.keys(all)).toEqual(['a', 'b'])
    expect(Object.keys(changed)).toEqual(['a', 'b'])
    expect(changed.b).toBe('')
  })

  it('quirk: maps are never detected as changed against a map default (String() of both)', () => {
    const def = { k: 'old' }
    const { changed, all } = buildDraftValues([v({ name: 'm', type: 'map(string)', default: def })], { m: { k: 'new' } })
    expect(changed).toEqual({})
    expect(all).toEqual({ m: { k: 'new' } })
  })

  it('a map without default counts as changed', () => {
    const map = { k: 'v' }
    const { changed, all } = buildDraftValues([v({ name: 'm', type: 'map(string)' })], { m: map })
    expect(changed.m).toBe(map)
    expect(all.m).toBe(map)
  })

  it('uses the same stored value for changed and all', () => {
    const { changed, all } = buildDraftValues([teamVar('t')], { t: { Alpha: 'a' } })
    expect(changed.t).toBe(all.t)
  })

  it('cleans scoped maps: skips undefined, null and blank text; keeps 0, false and arrays; coerces by type', () => {
    const defs = [
      teamVar('s'),
      teamVar('n', { type: 'number' }),
      teamVar('l', { type: 'list(string)' }),
      teamVar('b', { type: 'bool' }),
    ]
    const form = {
      s: { Alpha: undefined, Beta: null, Gamma: '   ', Delta: 'keep', Eps: 0, Zeta: false },
      n: { Alpha: '3', Beta: '0', Gamma: '' },
      l: { Alpha: 'a, b,, c', Beta: ['x', ''], Gamma: ' ' },
      b: { Alpha: false, Beta: true },
    }
    const { all } = buildDraftValues(defs, form)
    expect(all).toEqual({
      s: { Delta: 'keep', Eps: 0, Zeta: false },
      n: { Alpha: 3, Beta: 0 },
      l: { Alpha: ['a', 'b', 'c'], Beta: ['x', ''] },
      b: { Alpha: false, Beta: true },
    })
  })

  it('treats a scoped value that is not a plain map as an empty map', () => {
    const defs = [teamVar('a'), teamVar('b'), teamVar('c'), teamVar('d')]
    const { changed, all } = buildDraftValues(defs, { a: 'text', b: ['Alpha'], c: null })
    expect(all).toEqual({ a: {}, b: {}, c: {}, d: {} })
    expect(changed).toEqual({})
  })

  it('a scoped variable is changed as soon as one slot has a value, whatever the default is', () => {
    const defs = [teamVar('t', { default: 'd' }), teamVar('u', { default: 'd' })]
    const { changed, all } = buildDraftValues(defs, { t: { Alpha: 'd' }, u: { Alpha: '' } })
    expect(changed).toEqual({ t: { Alpha: 'd' } })
    expect(all).toEqual({ t: { Alpha: 'd' }, u: {} })
  })

  it('keeps definition order in both results', () => {
    const defs = [v({ name: 'z' }), v({ name: 'a' }), teamVar('m')]
    const { changed, all } = buildDraftValues(defs, { z: '1', a: '2', m: { Alpha: '3' } })
    expect(Object.keys(all)).toEqual(['z', 'a', 'm'])
    expect(Object.keys(changed)).toEqual(['z', 'a', 'm'])
  })
})

describe('characterization: lists between text and storage', () => {
  it('round-trips text -> stored array -> text, normalising separators and dropping blanks', () => {
    const defs = [v({ name: 'l', type: 'list(string)', default: ['seed'] })]
    const { all } = buildDraftValues(defs, { l: ' b ,a,, c ' })
    expect(all.l).toEqual(['b', 'a', 'c'])
    expect(restoreFromDraft(defs, all, teams)).toEqual({ l: 'b, a, c' })
  })

  it('keeps blank entries of a stored array when it is shown again', () => {
    const defs = [v({ name: 'l', type: 'list(string)' })]
    const { all } = buildDraftValues(defs, { l: ['a', '', 'b'] })
    expect(restoreFromDraft(defs, all, teams)).toEqual({ l: 'a, , b' })
  })
})
