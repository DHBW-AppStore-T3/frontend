import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import { I18nextProvider } from 'react-i18next'
import { keyEchoI18n } from '../../helpers/render'

// Routes and views are the real ones, so the history the buttons leave behind is the real one too;
// only the backend and the sign-in are stand-ins.
vi.mock('@/api/app.api', () => ({
  appApi: {
    getById: vi.fn(),
    listVersionApprovals: vi.fn(),
    getRuntime: vi.fn(),
    list: vi.fn(),
    admin: {
      setRecommended: vi.fn(),
      setDeployVersion: vi.fn(),
      listPendingApprovals: vi.fn(),
    },
  },
}))
vi.mock('@/api/course.api', () => ({
  courseApi: { list: vi.fn(), getById: vi.fn() },
}))
vi.mock('@/api/user.api', () => ({
  userApi: { list: vi.fn(), search: vi.fn() },
}))
vi.mock('@/services/keycloak.service', () => ({
  keycloak: {
    getState: () => ({ isAuthenticated: true }),
    subscribe: () => () => {},
  },
}))

import { appApi } from '@/api/app.api'
import { courseApi } from '@/api/course.api'
import { userApi } from '@/api/user.api'
import { appRoutes } from '@/router'
import { useAuthStore } from '@/stores/auth.store'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToastStore } from '@/stores/toast.store'
import { useAdminViewStore } from '@/stores/admin-view.store'

const APP_DETAIL = '/apps/app-123'
const WIZARD_START = '/deployment/new/config'

const app = {
  appId: 'app-123',
  name: 'Test App',
  description: 'Eine Beschreibung',
  userId: 'teacher-1',
  git_link: 'https://github.com/example/app',
  is_private: false,
  created_at: '2026-01-01T00:00:00Z',
  user: { username: 'teacher' },
  versions: ['v1.0'],
  deploy_version: 'v1.0',
  hidden_by_admin: false,
  recommended: false,
  submit_all_versions: false,
}

// The views are loaded by a real dynamic import the first time a route needs them. Load every lazy
// route once up front (as routes.spec does), so the tests are about the flow and not about import time.
const loadLazyRoutes = (routes: RouteObject[]): Promise<unknown>[] =>
  routes.flatMap((r) => [
    ...(r.lazy ? [(r.lazy as () => Promise<unknown>)()] : []),
    ...loadLazyRoutes(r.children ?? []),
  ])

beforeAll(async () => {
  await Promise.all(loadLazyRoutes(appRoutes))
}, 120_000)

beforeEach(() => {
  vi.clearAllMocks()
  useToastStore.setState({ toasts: [] })
  useAdminViewStore.setState({ enabledByAccount: {} })
  useDeploymentStore.getState().resetDraft()
  useAuthStore.setState({
    isAuthenticated: true,
    user: { userId: 'teacher-1', role: 'teacher' } as never,
  })

  vi.mocked(appApi.getById).mockResolvedValue({ data: app } as never)
  vi.mocked(appApi.listVersionApprovals).mockResolvedValue({ data: [] } as never)
  vi.mocked(appApi.getRuntime).mockResolvedValue({ data: { runtime: 'kubernetes', scope: 'team' } } as never)
  vi.mocked(appApi.list).mockResolvedValue({ data: [] } as never)
  vi.mocked(courseApi.list).mockResolvedValue({ data: [] } as never)
  vi.mocked(userApi.list).mockResolvedValue({ data: [] } as never)
  vi.mocked(userApi.search).mockResolvedValue({ data: [] } as never)
})

function renderAt(history: string[]) {
  const router = createMemoryRouter(appRoutes, { initialEntries: history })
  render(
    <I18nextProvider i18n={keyEchoI18n()}>
      <RouterProvider router={router} />
    </I18nextProvider>,
  )
  return router
}

type Router = ReturnType<typeof renderAt>

const expectPath = (router: Router, pathname: string) =>
  waitFor(() => expect(router.state.location.pathname).toBe(pathname))

const appDetailShown = () => screen.findByRole('heading', { name: app.name })

async function startWizard(router: Router) {
  const deploy = await screen.findByRole('button', { name: /AppsDetailView\.deployButton/ })
  await waitFor(() => expect(deploy).toBeEnabled())
  await userEvent.click(deploy)
  await expectPath(router, WIZARD_START)
}

async function backToOverview(router: Router) {
  await appDetailShown()
  await userEvent.click(screen.getByRole('button', { name: /AppsDetailView\.backToOverview/ }))
  await expectPath(router, '/apps')
}

describe('wizard-back-navigation', () => {
  it('"Zurück zur Übersicht" führt nach /apps, auch nachdem der Assistent gestartet und verlassen wurde', async () => {
    const router = renderAt(['/apps', APP_DETAIL])
    await appDetailShown()

    await startWizard(router)
    await userEvent.click(await screen.findByTestId('btn-back'))
    await expectPath(router, APP_DETAIL)

    await backToOverview(router)
  })

  it.each([
    ['ohne vorherigen Assistenten-Besuch', ['/apps', APP_DETAIL]],
    ['bei Deep Link (ohne Verlauf)', [APP_DETAIL]],
  ])('"Zurück zur Übersicht" %s führt nach /apps', async (_case, history) => {
    const router = renderAt(history)

    await backToOverview(router)
  })
})
