import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, fireEvent, renderHook, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation, MemoryRouter } from 'react-router'
import { I18nextProvider } from 'react-i18next'
import type { ReactNode } from 'react'

vi.mock('@/api/app.api', () => ({ appApi: { getVariables: vi.fn() } }))

import { appApi } from '@/api/app.api'
import NewDeploymentVariableView from '@/views/NewDeploymentVariableView'
import NewDeploymentSummaryView from '@/views/NewDeploymentSummaryView'
import { useVariableForm } from '@/views/new-deployment/useVariableForm'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useAppStore } from '@/stores/app.store'
import { useToastStore } from '@/stores/toast.store'
import { keyEchoI18n, renderWithProviders } from '../../helpers/render'

// Characterization of the variables step and the summary's variable loading
// (frontend#89): how a saved ``userInputVar`` is read back, what is saved on "Next",
// and how the form hook sets and reads values. Written by hand against the code
// BEFORE the any -> typed refactor and kept unchanged afterwards. "quirk" marks
// results that look odd; none of them is a fix.

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

const renderVariables = () =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/deployment/new/variables" element={<NewDeploymentVariableView />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </>,
    { route: '/deployment/new/variables' },
  )

const renderSummary = () =>
  renderWithProviders(
    <Routes>
      <Route path="/deployment/new/summary" element={<NewDeploymentSummaryView />} />
      <Route path="*" element={<p>elsewhere</p>} />
    </Routes>,
    { route: '/deployment/new/summary' },
  )

const variable = (over: Record<string, unknown>) => ({ type: 'string', source: 'terraform', ...over })
const draft = () => useDeploymentStore.getState().draft
const toasts = () => useToastStore.getState().toasts.map((t) => [t.type, t.message])
const mockDefinitions = (defs: unknown[]) => vi.mocked(appApi.getVariables).mockResolvedValue({ data: defs } as never)
const next = () => userEvent.click(screen.getByRole('button', { name: /deployment\.actions\.next/ }))
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement

function seedDraft(over: Record<string, unknown> = {}) {
  const store = useDeploymentStore.getState()
  store.resetDraft()
  store.studentCache.clear()
  store.studentCache.set('u1', { username: 'ann' } as never)
  store.studentCache.set('u2', { username: 'bob' } as never)
  store.updateDraft({
    appId: 'app-1',
    name: 'Lab',
    releaseTag: 'v1',
    groupNames: ['Alpha', 'Beta'],
    assignments: [['u1'], ['u2']],
    ...over,
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  useToastStore.setState({ toasts: [] })
  seedDraft()
  mockDefinitions([variable({ name: 'region', default: 'eu' }), variable({ name: 'cpu', type: 'number', default: 2 })])
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('variables step: reading a saved userInputVar after a fresh load', () => {
  it('overrides defaults with a JSON string', async () => {
    seedDraft({ userInputVar: JSON.stringify({ region: 'us', cpu: 8 }) })
    renderVariables()
    await screen.findByText('region')
    expect(field('region').value).toBe('us')
    expect(field('cpu').value).toBe('8')
  })

  it('overrides defaults with an already parsed object', async () => {
    seedDraft({ userInputVar: { region: 'us' } })
    renderVariables()
    await screen.findByText('region')
    expect(field('region').value).toBe('us')
    expect(field('cpu').value).toBe('2')
  })

  it('invalid JSON warns, toasts and falls back to the defaults', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    seedDraft({ userInputVar: '{not json' })
    renderVariables()
    await screen.findByText('region')
    expect(field('region').value).toBe('eu')
    expect(toasts()).toContainEqual(['error', 'deployment.summary.invalidJson'])
    expect(warn).toHaveBeenCalledWith('Invalid JSON in userInputVar', expect.anything())
  })

  it.each([[''], ['   '], ['[1,2]'], ['5'], ['"text"'], [[1, 2]]])(
    'falls back to the defaults for %j, without a toast',
    async (raw) => {
      seedDraft({ userInputVar: raw })
      renderVariables()
      await screen.findByText('region')
      expect(field('region').value).toBe('eu')
      expect(toasts()).toEqual([])
    },
  )

  it('quirk: the JSON text "null" parses to null, the form load throws and reports a fetch error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    seedDraft({ userInputVar: 'null' })
    renderVariables()
    await waitFor(() => expect(toasts()).toContainEqual(['error', 'deployment.summary.fetchVarsError']))
    expect(draft().variableDefinitions).toHaveLength(2)
  })

  it('a saved empty string beats the default, a missing key does not', async () => {
    seedDraft({ userInputVar: { region: '' } })
    renderVariables()
    await screen.findByText('region')
    expect(field('region').value).toBe('')
    expect(field('cpu').value).toBe('2')
  })
})

describe('variables step: what "Next" saves', () => {
  it('saves userInputVar as a JSON STRING of the changed values and variables as the full object', async () => {
    renderVariables()
    await screen.findByText('cpu')
    fireEvent.change(field('cpu'), { target: { value: '8' } })

    await next()

    expect(typeof draft().userInputVar).toBe('string')
    expect(draft().userInputVar).toBe('{"cpu":8}')
    expect(draft().variables).toEqual({ region: 'eu', cpu: 8 })
    expect(screen.getByTestId('where')).toHaveTextContent('/deployment/new/summary')
  })

  it('saves "{}" when nothing differs from the defaults', async () => {
    renderVariables()
    await screen.findByText('cpu')

    await next()

    expect(draft().userInputVar).toBe('{}')
    expect(draft().variables).toEqual({ region: 'eu', cpu: 2 })
  })

  it('saves lists as arrays and scoped values per slot', async () => {
    mockDefinitions([
      variable({ name: 'tags', type: 'list(string)', default: ['a', 'b'] }),
      variable({ name: 'size', varScope: 'team', default: 'S' }),
    ])
    renderVariables()
    await screen.findByText('tags')
    expect(field('tags').value).toBe('a, b')

    fireEvent.change(field('tags'), { target: { value: 'x, y,, z' } })
    fireEvent.change(field('Team „Beta"'), { target: { value: 'L' } })
    await next()

    expect(JSON.parse(draft().userInputVar as string)).toEqual({
      tags: ['x', 'y', 'z'],
      size: { Alpha: 'S', Beta: 'L' },
    })
    expect(draft().variables).toEqual({ tags: ['x', 'y', 'z'], size: { Alpha: 'S', Beta: 'L' } })
  })

  it('quirk: a cleared number is saved as NaN in variables and as null in the JSON', async () => {
    renderVariables()
    await screen.findByText('cpu')
    fireEvent.change(field('cpu'), { target: { value: '' } })

    await next()

    expect(Number.isNaN((draft().variables as Record<string, unknown>).cpu)).toBe(true)
    expect(JSON.parse(draft().userInputVar as string)).toEqual({ cpu: null })
  })

  it('returns to the saved values when the step is opened again', async () => {
    mockDefinitions([variable({ name: 'tags', type: 'list(string)' }), variable({ name: 'cpu', type: 'number', default: 2 })])
    const first = renderVariables()
    await screen.findByText('tags')
    fireEvent.change(field('tags'), { target: { value: 'b, a' } })
    fireEvent.change(field('cpu'), { target: { value: '9' } })
    await next()
    first.unmount()
    vi.mocked(appApi.getVariables).mockClear()

    renderVariables()

    await waitFor(() => expect(field('tags').value).toBe('b, a'))
    expect(field('cpu').value).toBe('9')
    expect(appApi.getVariables).not.toHaveBeenCalled()
  })
})

describe('variables step: team renames', () => {
  it('ignores the slots of a vanished team and tells the user once', async () => {
    mockDefinitions([variable({ name: 'size', varScope: 'team', default: 'S' })])
    renderVariables()
    await screen.findByText('size')
    fireEvent.change(field('Team „Alpha"'), { target: { value: 'XL' } })

    act(() => {
      useDeploymentStore.getState().updateDraft({ groupNames: ['Alpha2', 'Beta'] })
    })

    await waitFor(() => expect(toasts()).toContainEqual(['info', 'deployment.variables.teamRenameToast']))
    expect(toasts().filter(([type]) => type === 'info')).toHaveLength(1)
    // the new team starts empty, nothing is re-seeded from the default
    expect(field('Team „Alpha2"').value).toBe('')
    expect(field('Team „Beta"').value).toBe('S')

    await next()
    expect(draft().variables).toEqual({ size: { Beta: 'S' } })
  })
})

describe('useVariableForm: setting and reading values', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={keyEchoI18n()}>
      <MemoryRouter>{children}</MemoryRouter>
    </I18nextProvider>
  )

  const setup = async (defs: unknown[], variables: Record<string, unknown> = {}) => {
    seedDraft({ variableDefinitions: defs, variables })
    const hook = renderHook(() => useVariableForm(), { wrapper })
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false))
    return hook
  }

  it('setValue replaces the value of one key and keeps the others', async () => {
    const { result } = await setup([variable({ name: 'a', default: 'x' }), variable({ name: 'b', default: 'y' })])

    act(() => result.current.setValue('a', 'changed'))

    expect(result.current.formValues).toEqual({ a: 'changed', b: 'y' })
  })

  it('setScopedValue updates one slot of an existing map and leaves the others', async () => {
    const { result } = await setup([variable({ name: 'size', varScope: 'team', default: 'S' })])

    act(() => result.current.setScopedValue('size', 'Alpha', 'L'))

    expect(result.current.formValues.size).toEqual({ Alpha: 'L', Beta: 'S' })
    expect(result.current.getScopedValue('size', 'Alpha')).toBe('L')
    expect(result.current.getScopedValue('size', 'Beta')).toBe('S')
  })

  it('setScopedValue starts a new map when the key held no map', async () => {
    const { result } = await setup([variable({ name: 'a', default: 'x' })])

    act(() => result.current.setScopedValue('a', 'Alpha', 'v'))
    expect(result.current.formValues.a).toEqual({ Alpha: 'v' })

    act(() => result.current.setScopedValue('fresh', 'Beta', 1))
    expect(result.current.formValues.fresh).toEqual({ Beta: 1 })

    act(() => result.current.setValue('arr', ['x']))
    act(() => result.current.setScopedValue('arr', 'Alpha', 'v'))
    expect(result.current.formValues.arr).toEqual({ Alpha: 'v' })
  })

  it('getScopedValue returns "" for a missing slot, a missing key, null, undefined and non-maps', async () => {
    const { result } = await setup([variable({ name: 'size', varScope: 'team', default: 'S' })])

    act(() => {
      result.current.setScopedValue('size', 'Alpha', null)
      result.current.setValue('text', 'abc')
      result.current.setValue('list', ['x'])
    })

    expect(result.current.getScopedValue('size', 'Alpha')).toBe('')
    expect(result.current.getScopedValue('size', 'Nope')).toBe('')
    expect(result.current.getScopedValue('missing', 'Alpha')).toBe('')
    expect(result.current.getScopedValue('text', 'Alpha')).toBe('')
    expect(result.current.getScopedValue('list', '0')).toBe('')
  })

  it('getScopedValue keeps falsy values that are not null or undefined', async () => {
    const { result } = await setup([variable({ name: 'size', varScope: 'team', default: 'S' })])

    act(() => {
      result.current.setScopedValue('size', 'Alpha', 0)
      result.current.setScopedValue('size', 'Beta', false)
    })

    expect(result.current.getScopedValue('size', 'Alpha')).toBe(0)
    expect(result.current.getScopedValue('size', 'Beta')).toBe(false)
  })

  it('restores stored draft values over the defaults', async () => {
    const { result } = await setup([variable({ name: 'a', default: 'x' })], { a: 'stored' })
    expect(result.current.formValues).toEqual({ a: 'stored' })
  })
})

describe('summary: loading missing variable definitions', () => {
  const defs = [
    { name: 'a', source: 'terraform', default: 'defA' },
    { name: 'b', source: 'terraform', default: 'defB' },
    { name: 'c', source: 'terraform' },
    { name: 'd', source: 'terraform', default: null },
  ]
  const seedSummary = (over: Record<string, unknown> = {}) => {
    seedDraft({ variableDefinitions: [], variables: {}, userInputVar: {}, ...over })
    useAppStore.setState({
      apps: [{ appId: 'app-1', name: 'App' } as never],
      fetchAppVariables: vi.fn().mockResolvedValue(defs),
    } as never)
  }

  it('merges draft values, then defaults for the gaps, then the overrides', async () => {
    seedSummary({ variables: { a: 'draft' }, userInputVar: JSON.stringify({ a: 'override', e: 'extra' }) })
    renderSummary()

    await waitFor(() => expect(draft().variableDefinitions).toHaveLength(4))

    // c has no default (not added), d has a null default (added as null)
    expect(draft().variables).toEqual({ a: 'override', b: 'defB', d: null, e: 'extra' })
  })

  it('takes the overrides from an already parsed object as well', async () => {
    seedSummary({ userInputVar: { b: 'override' } })
    renderSummary()
    await waitFor(() => expect(draft().variableDefinitions).toHaveLength(4))
    expect(draft().variables).toMatchObject({ a: 'defA', b: 'override' })
  })

  it('invalid JSON toasts and still merges the defaults', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    seedSummary({ userInputVar: '{oops' })
    renderSummary()
    await waitFor(() => expect(draft().variableDefinitions).toHaveLength(4))
    expect(toasts()).toContainEqual(['error', 'deployment.summary.invalidJson'])
    expect(draft().variables).toMatchObject({ a: 'defA', b: 'defB' })
  })

  it.each([[''], ['  '], ['[1]'], ['7']])('ignores an unusable userInputVar %j without a toast', async (raw) => {
    seedSummary({ userInputVar: raw })
    renderSummary()
    await waitFor(() => expect(draft().variableDefinitions).toHaveLength(4))
    expect(draft().variables).toMatchObject({ a: 'defA', b: 'defB' })
    expect(toasts()).toEqual([])
  })

  it('quirk: a draft value of null is kept, the default does not replace it', async () => {
    seedSummary({ variables: { a: null } })
    renderSummary()
    await waitFor(() => expect(draft().variableDefinitions).toHaveLength(4))
    expect((draft().variables as Record<string, unknown>).a).toBeNull()
  })

  it.each([
    [{ response: { status: 500 } }, 'deployment.summary.fetchVarsError500'],
    [{ response: { status: 404 } }, 'deployment.summary.fetchVarsError'],
    [{ response: {} }, 'deployment.summary.fetchVarsError'],
    [new Error('x'), 'deployment.summary.fetchVarsError'],
    [undefined, 'deployment.summary.fetchVarsError'],
    [null, 'deployment.summary.fetchVarsError'],
  ])('reports a load error %j as %s', async (failure, message) => {
    seedSummary()
    useAppStore.setState({ fetchAppVariables: vi.fn().mockRejectedValue(failure) } as never)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderSummary()
    await waitFor(() => expect(toasts()).toContainEqual(['error', message]))
    expect(draft().variableDefinitions).toEqual([])
  })

  it('does nothing when the app of the draft is not in the list', async () => {
    seedSummary()
    useAppStore.setState({ apps: [{ appId: 'other', name: 'X' } as never] })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    renderSummary()
    await waitFor(() => expect(console.warn).toHaveBeenCalledWith('No app selected or app not found'))
    expect(useAppStore.getState().fetchAppVariables).not.toHaveBeenCalled()
    expect(draft().variableDefinitions).toEqual([])
  })

  it('asks for the version label of the release tag (object form, text, or latest)', async () => {
    seedSummary({ releaseTag: { version: '2.1.0' } })
    renderSummary()
    await waitFor(() => expect(useAppStore.getState().fetchAppVariables).toHaveBeenCalledWith('app-1', '2.1.0'))
  })
})
