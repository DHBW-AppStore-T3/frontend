import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  // Views and the theme hook throw while these are set.
  failViews: new Set<string>(),
  failTheme: false,
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

// `useTheme` is read by the layouts; making it throw fails the layout itself.
vi.mock('@/theme/useTheme', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/theme/useTheme')>()
  return {
    ...actual,
    useTheme: () => {
      if (mocks.failTheme) throw new Error('layout exploded')
      return actual.useTheme()
    },
  }
})

const view = (name: string) =>
  function MockView() {
    if (mocks.failViews.has(name)) throw new Error(`secret internal detail of ${name}`)
    return <p data-testid={`view-${name}`}>{name}</p>
  }
vi.mock('@/views/AppsView', () => ({ default: view('apps') }))
vi.mock('@/views/DashboardView', () => ({ default: view('dashboard') }))
vi.mock('@/views/UserView', () => ({ default: view('user') }))
vi.mock('@/views/LoginView', () => ({ default: view('login') }))
// A chunk that cannot be loaded (e.g. after a new release): the import rejects.
vi.mock('@/views/HelpView', () => {
  throw new Error('Failed to fetch dynamically imported module')
})

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

const loginAs = (role: 'student' | 'teacher' | 'admin') => {
  mocks.auth.isAuthenticated = true
  mocks.auth.user = { userId: 'u', role }
  mocks.auth.hasAnyRole = (...roles: string[]) => roles.includes(role)
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  mocks.auth.user = null
  mocks.auth.isAuthenticated = false
  mocks.auth.initialize.mockReset().mockResolvedValue(undefined)
  mocks.auth.hasAnyRole = () => false
  mocks.draft = { appId: null, name: '', studentIds: [] }
  mocks.failViews.clear()
  mocks.failTheme = false
  // React and the router log caught render errors; keep the output readable.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
})

const title = () => i18n.t('router.error.title')

describe('route error boundaries', () => {
  it.each([
    ['app layout', '/apps', 'apps', '.app-shell', true],
    ['user layout', '/user', 'user', '.app-shell', true],
    ['auth layout', '/login', 'login', '.auth-page', false],
  ])(
    'a view that throws while rendering shows the error page inside the %s',
    async (_name, url, viewName, shell, needsLogin) => {
      if (needsLogin) loginAs('student')
      mocks.failViews.add(viewName)
      renderAt(url)

      const alert = await screen.findByRole('alert')
      expect(within(alert).getByText(title())).toBeInTheDocument()
      // The layout around the failed page is still there.
      const layout = document.querySelector(shell)
      expect(layout).not.toBeNull()
      expect(layout!.contains(alert)).toBe(true)
    },
  )

  it('keeps the navigation of the app layout usable', async () => {
    loginAs('student')
    mocks.failViews.add('apps')
    renderAt('/apps')

    await screen.findByRole('alert')
    expect(document.querySelector('.app-shell nav')).not.toBeNull()
  })

  it('clears the error when navigating to another route', async () => {
    loginAs('student')
    mocks.failViews.add('apps')
    const router = renderAt('/apps')
    await screen.findByRole('alert')

    await act(async () => {
      await router.navigate('/dashboard')
    })

    await waitFor(() => expect(screen.getByTestId('view-dashboard')).toBeInTheDocument())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows the error page when a view chunk cannot be loaded', async () => {
    loginAs('student')
    renderAt('/help')

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText(title())).toBeInTheDocument()
    expect(document.querySelector('.app-shell')!.contains(alert)).toBe(true)
  })

  it('falls back to a standalone error page when the layout itself fails', async () => {
    loginAs('student')
    mocks.failTheme = true
    renderAt('/apps')

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText(title())).toBeInTheDocument()
    expect(document.querySelector('.app-shell')).toBeNull()
  })

  it('does not leak the error message or a stack trace into the page', async () => {
    loginAs('student')
    mocks.failViews.add('apps')
    renderAt('/apps')

    await screen.findByRole('alert')
    const text = document.body.textContent ?? ''
    expect(text).not.toContain('secret internal detail')
    expect(text).not.toMatch(/\bat\s+\S+\s+\(.*:\d+:\d+\)/)
  })

  it('logs the error once', async () => {
    loginAs('student')
    mocks.failViews.add('apps')
    renderAt('/apps')

    await screen.findByRole('alert')
    // React logs the render error itself; RouteError adds exactly one entry.
    const own = consoleError.mock.calls.filter((args: unknown[]) => args[0] === '[RouteError]')
    expect(own).toHaveLength(1)
  })

  it('offers a link back to the dashboard and a reload button', async () => {
    loginAs('student')
    mocks.failViews.add('apps')
    renderAt('/apps')

    const alert = await screen.findByRole('alert')
    const link = within(alert).getByRole('link', { name: i18n.t('router.error.backToDashboard') })
    expect(link).toHaveAttribute('href', '/dashboard')

    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } })
    try {
      await userEvent.click(within(alert).getByRole('button', { name: i18n.t('router.error.reload') }))
      expect(reload).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original })
    }
  })
})
