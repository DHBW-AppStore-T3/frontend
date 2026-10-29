import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { act, configure, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import { I18nextProvider } from 'react-i18next'

// The wizard runs on its real routes and views; only the backend and the sign-in are stand-ins.
const mocks = vi.hoisted(() => ({
  auth: {
    user: { userId: 't1', role: 'teacher' } as unknown,
    isLoading: false,
    isAuthenticated: true,
    initialize: vi.fn(),
    hasAnyRole: (...roles: string[]) => roles.includes('teacher'),
  },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: Object.assign((sel: (s: unknown) => unknown) => sel(mocks.auth), { getState: () => mocks.auth }),
}))
vi.mock('@/api/course.api', () => ({ courseApi: { list: vi.fn(), getById: vi.fn() } }))
vi.mock('@/api/user.api', () => ({ userApi: { list: vi.fn(), search: vi.fn(), getById: vi.fn() } }))
vi.mock('@/api/app.api', () => ({ appApi: { getRuntime: vi.fn(), getVariables: vi.fn(), list: vi.fn(), getById: vi.fn() } }))

import { appRoutes } from '@/router'
import { appApi } from '@/api/app.api'
import { courseApi } from '@/api/course.api'
import { userApi } from '@/api/user.api'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useAppStore } from '@/stores/app.store'
import { keyEchoI18n } from '../../helpers/render'

const john = { userId: 'u1', firstName: 'John', lastName: 'Doe' }
const jane = { userId: 'u2', firstName: 'Jane', lastName: 'Roe' }
const region = { name: 'region', type: 'string', source: 'terraform', default: 'eu' }

// These tests render the whole layout on real routes. Locally each takes about 100 ms; on the CI
// runner, under coverage and with other test files running in parallel, single runs took more than the
// 5 s a test and the 1 s a findBy/waitFor get by default. A real hang still fails, just later.
vi.setConfig({ testTimeout: 30_000 })
configure({ asyncUtilTimeout: 10_000 })

// The views are loaded by a real dynamic import the first time a route needs them. With coverage
// instrumentation on a CI runner that can take longer than a test's 5 s, so load every lazy route
// once up front (as routes.spec does) and keep the tests about the flow.
const loadLazyRoutes = (routes: RouteObject[]): Promise<unknown>[] =>
  routes.flatMap((r) => [
    ...(r.lazy ? [(r.lazy as () => Promise<unknown>)()] : []),
    ...loadLazyRoutes(r.children ?? []),
  ])

beforeAll(async () => {
  await Promise.all(loadLazyRoutes(appRoutes))
}, 120_000)

function startWizard() {
  const store = useDeploymentStore.getState()
  store.resetDraft()
  store.studentCache.clear()
  store.studentCache.set('u1', john as never)
  store.studentCache.set('u2', jane as never)
  // What AppsDetailView.startDeployment puts into the draft, plus the name and students of step 1.
  store.updateDraft({
    appId: 'app-1',
    name: 'Lab',
    releaseTag: '1.0.0',
    studentIds: ['u1', 'u2'],
    runtime: 'kubernetes',
    scope: 'team',
    resourceChoices: [],
    resources: {},
    networkChoices: {},
    network: {},
  })
}

function renderWizard(url = '/deployment/new/config') {
  const router = createMemoryRouter(appRoutes, { initialEntries: [url] })
  render(
    <I18nextProvider i18n={keyEchoI18n()}>
      <RouterProvider router={router} />
    </I18nextProvider>,
  )
  return router
}

// router.state changes before React commits the new view (the update is a transition), so for a
// moment the DOM still holds the previous step. A button found then is detached by the commit and a
// click on it is lost. Wait for something only the target step renders: then state and DOM agree.
const shown: Record<string, () => Promise<unknown>> = {
  '/deployment/new/config': () => screen.findByTestId('deployment-name'),
  '/deployment/new/teams': () => screen.findByRole('button', { name: 'deployment.groups.one' }),
  '/deployment/new/variables': () =>
    screen.findByRole('heading', { level: 1, name: 'deployment.summary.variablesConfigTitle' }),
  '/deployment/new/summary': () => screen.findByText('deployment.summary.title'),
}

const at = async (router: ReturnType<typeof renderWizard>, path: string) => {
  await waitFor(() => expect(router.state.location.pathname).toBe(path))
  await shown[path]!()
}

/** Step 2: put everybody into one team and press "Weiter". */
async function assignAndContinue() {
  await userEvent.click(await screen.findByRole('button', { name: 'deployment.groups.one' }))
  const next = screen.getByTestId('btn-next')
  await waitFor(() => expect(next).toBeEnabled())
  await userEvent.click(next)
}

const stepLabels = () => ['config', 'assignment', 'vars', 'summary'].filter((k) => screen.queryByText(`deployment.steps.${k}`))

beforeEach(() => {
  vi.clearAllMocks()
  startWizard()
  useAppStore.setState({ apps: [], currentApp: null })
  vi.mocked(appApi.getRuntime).mockResolvedValue({ data: { runtime: 'kubernetes', scope: 'team' } } as never)
  vi.mocked(appApi.list).mockResolvedValue({ data: [] } as never)
  // The catalogue keeps its own list: the summary has to ask for the app of the draft.
  vi.mocked(appApi.getById).mockResolvedValue({ data: { appId: 'app-1', name: 'Lab App', image: null } } as never)
  vi.mocked(appApi.getVariables).mockResolvedValue({ data: [] } as never)
  vi.mocked(courseApi.list).mockResolvedValue({ data: [] } as never)
  vi.mocked(userApi.list).mockResolvedValue({ data: [john, jane] } as never)
  vi.mocked(userApi.search).mockResolvedValue({ data: [] } as never)
  vi.mocked(userApi.getById).mockResolvedValue({ data: john } as never)
})

describe('wizard flow: an app without variables, choices and network', () => {
  it('goes from the teams straight to the summary and back, with three steps', async () => {
    const router = renderWizard()

    // Step 1 asks the backend for the definitions on entry.
    await userEvent.click(await screen.findByTestId('btn-next'))
    await at(router, '/deployment/new/teams')
    expect(appApi.getVariables).toHaveBeenCalledTimes(1)

    await assignAndContinue()
    await at(router, '/deployment/new/summary')
    expect(stepLabels()).toEqual(['config', 'assignment', 'summary'])
    // With the store's list empty the app is asked for by id, once.
    await waitFor(() => expect(appApi.getById).toHaveBeenCalledExactlyOnceWith('app-1'))
    expect(useAppStore.getState().currentApp).toMatchObject({ name: 'Lab App' })

    await userEvent.click(screen.getByRole('button', { name: /deployment\.actions\.back/ }))
    await at(router, '/deployment/new/teams')

    // The answer was asked for once per draft, also on the way back and forth.
    expect(appApi.getVariables).toHaveBeenCalledTimes(1)
  })

  it('does not loop with the browser back button, and /variables sends you back to the teams', async () => {
    const router = renderWizard('/deployment/new/teams')
    await assignAndContinue()
    await at(router, '/deployment/new/summary')

    await act(() => router.navigate(-1))
    await at(router, '/deployment/new/teams')

    await act(() => router.navigate('/deployment/new/variables'))
    await at(router, '/deployment/new/teams')
    // The redirect replaced the entry instead of adding one: the summary is still ahead in the history.
    expect(router.state.historyAction).toBe('REPLACE')
    await act(() => router.navigate(1))
    await at(router, '/deployment/new/summary')
  })

  it('shows a progress bar with three steps in all three views', async () => {
    const router = renderWizard()
    await screen.findByTestId('btn-next')
    await waitFor(() => expect(screen.queryByText('deployment.steps.vars')).not.toBeInTheDocument())
    expect(stepLabels()).toEqual(['config', 'assignment', 'summary'])

    await userEvent.click(screen.getByTestId('btn-next'))
    await at(router, '/deployment/new/teams')
    await screen.findByRole('button', { name: 'deployment.groups.one' })
    expect(stepLabels()).toEqual(['config', 'assignment', 'summary'])
  })
})

describe('wizard flow: an app with a variable', () => {
  beforeEach(() => {
    vi.mocked(appApi.getVariables).mockResolvedValue({ data: [region] } as never)
  })

  it('keeps all four steps and goes through the variables step as before', async () => {
    const router = renderWizard()
    await userEvent.click(await screen.findByTestId('btn-next'))
    await at(router, '/deployment/new/teams')

    await assignAndContinue()
    await at(router, '/deployment/new/variables')
    expect(await screen.findByLabelText('region')).toHaveValue('eu')
    expect(stepLabels()).toEqual(['config', 'assignment', 'vars', 'summary'])
    // loaded by step 1; the variables step does not ask a second time
    expect(appApi.getVariables).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: /deployment\.actions\.next/ }))
    await at(router, '/deployment/new/summary')
    expect(stepLabels()).toEqual(['config', 'assignment', 'vars', 'summary'])

    await userEvent.click(screen.getByRole('button', { name: /deployment\.actions\.back/ }))
    await at(router, '/deployment/new/variables')
  })

  it('when the backend is slow, "Weiter" waits for the answer and then decides', async () => {
    let answer!: (value: unknown) => void
    vi.mocked(appApi.getVariables).mockReturnValue(new Promise((resolve) => (answer = resolve)) as never)
    const router = renderWizard('/deployment/new/teams')

    await userEvent.click(await screen.findByRole('button', { name: 'deployment.groups.one' }))
    await waitFor(() => expect(screen.getByTestId('btn-next')).toBeEnabled())
    await userEvent.click(screen.getByTestId('btn-next'))
    expect(router.state.location.pathname).toBe('/deployment/new/teams')

    await act(async () => answer({ data: [region] }))

    await at(router, '/deployment/new/variables')
  })
})

describe('wizard flow: the definitions cannot be loaded', () => {
  it('does not skip the variables step', async () => {
    vi.mocked(appApi.getVariables).mockRejectedValue(new Error('boom'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = renderWizard('/deployment/new/teams')

    await assignAndContinue()

    await at(router, '/deployment/new/variables')
  })
})
