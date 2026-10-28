import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'

// --- Mocks: API modules that make real network calls ---
vi.mock('@/api/app.api', () => ({
  appApi: {
    getById: vi.fn(),
    listVersionApprovals: vi.fn(),
    getRuntime: vi.fn(),
    list: vi.fn().mockResolvedValue({ data: [] }),
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

const baseApp = {
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

// Load all lazy routes once so dynamic imports don't time out the assertions.
import type { RouteObject } from 'react-router'
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

  // Log in as teacher (can deploy).
  useAuthStore.setState({
    isAuthenticated: true,
    user: { userId: 'teacher-1', role: 'teacher' } as any,
  })

  vi.mocked(appApi.getById).mockResolvedValue({ data: baseApp } as any)
  vi.mocked(appApi.listVersionApprovals).mockResolvedValue({ data: [] } as any)
  vi.mocked(appApi.getRuntime).mockResolvedValue({
    data: { runtime: 'kubernetes', scope: 'team' },
  } as any)
  vi.mocked(courseApi.list).mockResolvedValue({ data: [] } as any)
  vi.mocked(userApi.list).mockResolvedValue({ data: [] } as any)
  vi.mocked(userApi.search).mockResolvedValue({ data: [] } as any)
})

function renderAt(initialEntries: string[], initialIndex?: number) {
  const router = createMemoryRouter(appRoutes, {
    initialEntries,
    initialIndex: initialIndex ?? initialEntries.length - 1,
  })
  render(
    <I18nextProvider i18n={i18n}>
      <RouterProvider router={router} />
    </I18nextProvider>,
  )
  return router
}

describe('wizard-back-navigation', () => {
  it('Vollständiger Ablauf: Assistent starten, Zurück, Zurück zur Übersicht → /apps', async () => {
    // Start at /apps/app-123 with /apps in history.
    const router = renderAt(['/apps', '/apps/app-123'], 1)

    // Wait for the App detail page to render.
    await screen.findByRole('heading', { name: 'Test App' })

    // Click "Deployment starten" / "Jetzt Deployen" button.
    const deployBtn = await screen.findByRole('button', {
      name: /Jetzt Deployen|Deployment starten/,
    })
    await userEvent.click(deployBtn)

    // Should now be on the wizard config step.
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/deployment/new/config'),
    )

    // Click "Zurück" in the wizard (btn-back).
    const backInWizard = await screen.findByTestId('btn-back')
    await userEvent.click(backInWizard)

    // Should be back on the App detail page.
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/apps/app-123'),
    )

    // Click "Zurück zur Übersicht" on the App detail page.
    await screen.findByRole('heading', { name: 'Test App' })
    const backToOverview = screen.getByRole('button', {
      name: /Zurück zur Übersicht/,
    })
    await userEvent.click(backToOverview)

    // Must land on /apps, NOT back in the wizard.
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/apps'),
    )
  })

  it('"Zurück zur Übersicht" ohne vorherigen Assistenten-Besuch führt nach /apps', async () => {
    const router = renderAt(['/apps', '/apps/app-123'], 1)
    await screen.findByRole('heading', { name: 'Test App' })

    await userEvent.click(
      screen.getByRole('button', { name: /Zurück zur Übersicht/ }),
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/apps'),
    )
  })

  it('"Zurück zur Übersicht" bei Deep Link (ohne Verlauf) führt nach /apps', async () => {
    const router = renderAt(['/apps/app-123'])
    await screen.findByRole('heading', { name: 'Test App' })

    await userEvent.click(
      screen.getByRole('button', { name: /Zurück zur Übersicht/ }),
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/apps'),
    )
  })
})
