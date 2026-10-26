import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'

const mocks = vi.hoisted(() => ({
  auth: {
    user: null as any,
    isLoading: false,
    isAuthenticated: false,
    initialize: vi.fn(),
    hasAnyRole: (..._r: string[]): boolean => false,
  },
  draft: { appId: null, name: '', studentIds: [] as string[] },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: Object.assign(
    (sel: (s: unknown) => unknown) => sel(mocks.auth),
    { getState: () => mocks.auth },
  ),
}))
vi.mock('@/stores/deployment.store', () => ({
  useDeploymentStore: { getState: () => ({ draft: mocks.draft }) },
}))

vi.mock('@/views/CoursesView', () => ({ default: () => <p>courses</p> }))
vi.mock('@/views/AppsView', () => ({ default: () => <p>apps</p> }))
vi.mock('@/views/DashboardView', () => ({ default: () => <p>dashboard</p> }))
vi.mock('@/views/AddAppsView', () => ({ default: () => <p>add-app</p> }))
vi.mock('@/views/NewDeploymentConfigView', () => ({ default: () => <p>wizard-config</p> }))
vi.mock('@/views/SettingsOpenStackView', () => ({ default: () => <p>openstack-settings</p> }))
vi.mock('@/views/DeploymentDetailView', () => ({
  default: () => <p data-testid="detail-view">detail</p>,
}))

import { appRoutes } from '@/router'

function renderAt(url: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [url] })
  render(
    <I18nextProvider i18n={i18n}>
      <RouterProvider router={router} />
    </I18nextProvider>,
  )
  return router
}

beforeEach(() => {
  mocks.auth.user = null
  mocks.auth.isAuthenticated = false
  mocks.auth.initialize.mockReset().mockResolvedValue(undefined)
  mocks.auth.hasAnyRole = () => false
  mocks.draft = { appId: null, name: '', studentIds: [] }
})

// Role as the real store derives it: hasAnyRole looks at the user.
const loginAs = (role: 'student' | 'teacher' | 'admin') => {
  mocks.auth.isAuthenticated = true
  mocks.auth.user = { userId: 'u', role }
  mocks.auth.hasAnyRole = (...roles: string[]) => roles.includes(role)
}

describe('app routes', () => {
  it('redirects unauthenticated users from a protected route to /login with returnUrl', async () => {
    const router = renderAt('/apps')

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(router.state.location.search).toBe(`?returnUrl=${encodeURIComponent('/apps')}`)
  })

  it('renders /login inside the auth layout for guests', async () => {
    const router = renderAt('/login')

    await waitFor(() => expect(document.querySelector('.auth-page')).not.toBeNull())
    expect(router.state.location.pathname).toBe('/login')
  })

  it('renders protected routes inside the app layout when authenticated', async () => {
    mocks.auth.isAuthenticated = true
    mocks.auth.user = { userId: 'u', role: 'student' }
    renderAt('/apps')

    await waitFor(() => expect(document.querySelector('.app-shell')).not.toBeNull())
  })

  it('sends role-less users from admin routes to /forbidden', async () => {
    mocks.auth.isAuthenticated = true
    mocks.auth.user = { userId: 'u', role: 'student' }
    const router = renderAt('/admin/apps')

    await waitFor(() => expect(router.state.location.pathname).toBe('/forbidden'))
  })

  it('sends incomplete wizard deep-links back to the matching earlier step', async () => {
    loginAs('teacher')
    const router = renderAt('/deployment/new/summary')

    await waitFor(() => expect(router.state.location.pathname).toBe('/apps'))
  })

  it('always hosts the global Toast outlet', async () => {
    renderAt('/login')
    await waitFor(() => expect(document.body.querySelector('.toast-container')).not.toBeNull())
  })

  it('redirects unknown paths to the root', async () => {
    mocks.auth.isAuthenticated = true
    mocks.auth.user = { userId: 'u', role: 'student' }
    const router = renderAt('/does/not/exist')

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })
})

describe('staff-only routes (teachers and admins register apps and deploy)', () => {
  const STAFF_ONLY = [
    '/apps/create',
    '/deployment/new/config',
    '/deployment/new/teams',
    '/deployment/new/variables',
    '/deployment/new/summary',
    '/courses',
  ]

  it.each(STAFF_ONLY)('sends a student from %s to /forbidden', async (url) => {
    loginAs('student')
    const router = renderAt(url)

    await waitFor(() => expect(router.state.location.pathname).toBe('/forbidden'))
  })

  it.each([
    ['teacher', '/apps/create'],
    ['admin', '/apps/create'],
    ['teacher', '/deployment/new/config'],
  ] as const)('lets a %s open %s', async (role, url) => {
    loginAs(role)
    const router = renderAt(url)

    await waitFor(() => expect(document.querySelector('.app-shell, .user-shell, main')).not.toBeNull())
    expect(router.state.location.pathname).toBe(url)
  })

  it('keeps the admin review admin-only', async () => {
    loginAs('teacher')
    const router = renderAt('/admin/apps')

    await waitFor(() => expect(router.state.location.pathname).toBe('/forbidden'))
  })

  it('keeps the admin settings admin-only', async () => {
    loginAs('teacher')
    const router = renderAt('/admin/settings')

    await waitFor(() => expect(router.state.location.pathname).toBe('/forbidden'))
  })

  it('lets admins open the admin settings', async () => {
    loginAs('admin')
    const router = renderAt('/admin/settings')

    await waitFor(() => expect(document.querySelector('.app-shell')).not.toBeNull())
    expect(router.state.location.pathname).toBe('/admin/settings')
  })

  it('lets every signed-in role open the app catalogue and the deployments', async () => {
    loginAs('student')
    const router = renderAt('/apps')

    await waitFor(() => expect(document.querySelector('.app-shell')).not.toBeNull())
    expect(router.state.location.pathname).toBe('/apps')
  })
})

describe('deployment routes', () => {
  it('renders the deployment detail view for /deployments/:id inside the app layout', async () => {
    mocks.auth.isAuthenticated = true
    mocks.auth.user = { userId: 'u', role: 'student' }
    renderAt('/deployments/abc')

    await waitFor(() => expect(document.querySelector('.app-shell')).not.toBeNull())
    await waitFor(() => expect(document.querySelector('[data-testid="detail-view"]')).not.toBeNull())
  })
})
