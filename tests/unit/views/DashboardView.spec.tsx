import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen } from '@testing-library/react'

// Stats and quotas are separate, individually tested units; here they are
// driven directly so the view's wiring and rendering can be asserted.
const mocks = vi.hoisted(() => ({
  fetchStats: vi.fn(() => Promise.resolve()),
  fetchQuotas: vi.fn(),
  quotas: {
    formattedQuotas: [] as any[],
    loading: false,
    needsCredentials: false,
    hasCachedQuotas: true,
  },
}))

vi.mock('@/services/keycloak.service', () => ({
  keycloak: { getState: () => ({ isAuthenticated: true }), subscribe: () => () => {} },
}))
vi.mock('@/composables/useDashboard', () => ({
  useDashboard: () => ({
    stats: { deployments: 3, apps: 7, courses: 2, loading: false },
    fetchStats: mocks.fetchStats,
  }),
}))
vi.mock('@/composables/useQuotas', () => ({
  useQuotas: () => ({
    ...mocks.quotas,
    fetchQuotas: mocks.fetchQuotas,
    getColorClass: (p: number) => (p >= 90 ? 'bg-red-500' : 'bg-green-500'),
  }),
}))

import DashboardView from '@/views/DashboardView'
import { useAuthStore } from '@/stores/auth.store'
import { useOpenStackCredentialsStore } from '@/stores/openstack-credentials.store'
import { renderWithProviders } from '../../helpers/render'

const fetchCredentials = vi.fn()

const setCreds = (over: Record<string, unknown>) =>
  useOpenStackCredentialsStore.setState({ status: null, error: null, fetch: fetchCredentials, ...over } as any)

const setUser = (user: Record<string, unknown> | null) => useAuthStore.setState({ user } as any)

const renderView = () => renderWithProviders(<DashboardView />)

describe('DashboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.quotas.formattedQuotas = []
    mocks.quotas.loading = false
    mocks.quotas.needsCredentials = false
    mocks.quotas.hasCachedQuotas = true
    setUser({ username: 'john', role: 'student' })
    setCreds({})
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 5, 7, 14, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads stats, quotas and credentials on mount', () => {
    renderView()
    expect(mocks.fetchStats).toHaveBeenCalledTimes(1)
    expect(mocks.fetchQuotas).toHaveBeenCalledTimes(1)
    expect(fetchCredentials).toHaveBeenCalledTimes(1)
  })

  it('does not re-fetch credentials that are already loaded', () => {
    setCreds({ status: { has_credential: true } })
    renderView()
    expect(fetchCredentials).not.toHaveBeenCalled()
  })

  it('greets the user by a capitalised username', () => {
    setUser({ username: 'maximilian' })
    renderView()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Maximilian')
  })

  it('renders the greeting without a name when no user is loaded yet', () => {
    setUser(null)
    renderView()
    expect(screen.getByText('DashboardView.timeGreetings.afternoon')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toBeEmptyDOMElement()
  })

  it.each([
    [9, 'DashboardView.timeGreetings.morning'],
    [14, 'DashboardView.timeGreetings.afternoon'],
    [20, 'DashboardView.timeGreetings.evening'],
  ])('greets according to the hour (%i:00)', (hour, expected) => {
    vi.setSystemTime(new Date(2026, 5, 7, hour, 0, 0))
    renderView()
    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it('shows the KPI numbers and links', () => {
    renderView()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /DashboardView\.deployments/ })).toHaveAttribute('href', '/deployments')
    expect(screen.getByRole('link', { name: /DashboardView\.apps/ })).toHaveAttribute('href', '/apps')
  })

  it('hides the courses tile from non-staff users', () => {
    renderView()
    expect(screen.queryByRole('link', { name: /DashboardView\.courses/ })).not.toBeInTheDocument()
  })

  it('shows the courses tile to staff', () => {
    setUser({ username: 'john', role: 'teacher' })
    renderView()
    expect(screen.getByRole('link', { name: /DashboardView\.courses/ })).toHaveAttribute('href', '/courses')
  })

  it('warns when credentials are resolved but missing', () => {
    setCreds({ status: { has_credential: false } })
    renderView()
    expect(screen.getByText('banners.credentialsMissing.title')).toBeInTheDocument()
  })

  it('shows the validation error banner for a stored but invalid credential', () => {
    setCreds({ status: { has_credential: true, last_validation_error: 'bad token' } })
    renderView()
    expect(screen.getByText('banners.credentialsInvalid.title')).toBeInTheDocument()
    expect(screen.getByText('bad token')).toBeInTheDocument()
  })

  it('shows no banner before the credentials have resolved', () => {
    renderView()
    expect(screen.queryByText('banners.credentialsMissing.title')).not.toBeInTheDocument()
  })

  it('renders quota rows with usage and colour', () => {
    mocks.quotas.formattedQuotas = [
      { icon: () => <svg />, label: 'Instances', used: 9, limit: 10, percentage: 90, unit: '' },
    ]
    renderView()
    expect(screen.getByText('Instances')).toBeInTheDocument()
    expect(screen.getByText('9/10')).toBeInTheDocument()
    expect(document.querySelector('.bg-red-500')).not.toBeNull()
  })

  it('shows the skeleton on the initial load and the setup hint without credentials', () => {
    mocks.quotas.loading = true
    mocks.quotas.hasCachedQuotas = false
    const { container, unmount } = renderView()
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(6)
    unmount()

    mocks.quotas.loading = false
    mocks.quotas.needsCredentials = true
    renderView()
    expect(screen.getByText('DashboardView.noCredentialsTitle')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /DashboardView\.setUpNow/ })).toHaveAttribute('href', '/user/openstack')
  })

  it('shows the load error when there is no data and no credential problem', () => {
    renderView()
    expect(screen.getByText('DashboardView.quotaLoadError')).toBeInTheDocument()
  })
})
