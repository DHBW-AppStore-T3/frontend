import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Stats and quotas are separate, individually tested units; here they are
// driven directly so the view's wiring and rendering can be asserted.
const mocks = vi.hoisted(() => ({
  fetchStats: vi.fn(() => Promise.resolve()),
  fetchQuotas: vi.fn(),
  selectCredential: vi.fn(),
  quotas: {
    credentialId: null as string | null,
    formattedQuotas: [] as any[],
    loading: false,
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
    selectCredential: mocks.selectCredential,
    fetchQuotas: mocks.fetchQuotas,
    getColorClass: (p: number) => (p >= 90 ? 'bg-red-500' : 'bg-green-500'),
  }),
}))

import DashboardView from '@/views/DashboardView'
import { useAuthStore } from '@/stores/auth.store'
import { useOpenStackCredentialsStore } from '@/stores/openstack-credentials.store'
import { renderWithProviders } from '../../helpers/render'

const fetchCredentials = vi.fn()

const credential = (id: string, over: Record<string, unknown> = {}) => ({
  credentialId: id,
  project_id: `p-${id}`,
  project_name: `Project ${id}`,
  project_verified: true,
  last_validation_error: null,
  active_deployments: 0,
  ...over,
})

const setCreds = (credentials: unknown[] | null) =>
  useOpenStackCredentialsStore.setState({ credentials, error: null, fetch: fetchCredentials } as any)

const setUser = (user: Record<string, unknown> | null) => useAuthStore.setState({ user } as any)

const renderView = () => renderWithProviders(<DashboardView />)

describe('DashboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.quotas.credentialId = null
    mocks.quotas.formattedQuotas = []
    mocks.quotas.loading = false
    mocks.quotas.hasCachedQuotas = true
    setUser({ username: 'john', role: 'student' })
    setCreds(null)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 5, 7, 14, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads the stats on mount', () => {
    renderView()
    expect(mocks.fetchStats).toHaveBeenCalledTimes(1)
  })

  describe('OpenStack credentials and quotas (staff only; VM apps need them)', () => {
    beforeEach(() => setUser({ username: 'john', role: 'teacher' }))

    it('reads the credentials and shows the quota of the first usable project', () => {
      setCreds([credential('c-1'), credential('c-2')])
      renderView()

      expect(mocks.selectCredential).toHaveBeenCalledWith('c-1')
      expect(mocks.fetchQuotas).toHaveBeenCalledTimes(1)
    })

    it('fetches credentials that are not loaded yet', () => {
      renderView()
      expect(fetchCredentials).toHaveBeenCalledTimes(1)
      expect(mocks.fetchQuotas).not.toHaveBeenCalled()
    })

    it('does not re-fetch credentials that are already loaded', () => {
      setCreds([credential('c-1')])
      renderView()
      expect(fetchCredentials).not.toHaveBeenCalled()
    })

    it('keeps the chosen project while it is usable', () => {
      mocks.quotas.credentialId = 'c-2'
      setCreds([credential('c-1'), credential('c-2')])
      renderView()

      expect(mocks.selectCredential).toHaveBeenCalledWith('c-2')
    })

    it('lets staff with several projects switch between them', async () => {
      mocks.quotas.credentialId = 'c-1'
      setCreds([credential('c-1'), credential('c-2')])
      renderView()
      const user = userEvent.setup()

      await user.selectOptions(screen.getByTestId('quota-credential'), 'c-2')

      expect(mocks.selectCredential).toHaveBeenLastCalledWith('c-2')
    })

    it('names the only project instead of offering a choice', () => {
      mocks.quotas.credentialId = 'c-1'
      setCreds([credential('c-1')])
      renderView()

      expect(screen.getByText('Project c-1')).toBeInTheDocument()
      expect(screen.queryByTestId('quota-credential')).not.toBeInTheDocument()
    })

    it('asks to set up a credential when there is no usable one', () => {
      setCreds([])
      renderView()

      expect(screen.getByText('DashboardView.noCredentialsTitle')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /DashboardView\.setUpNow/ })).toHaveAttribute('href', '/user/openstack')
      expect(screen.queryByText('banners.credentialsUnverified.title')).not.toBeInTheDocument()
    })

    it('warns about credentials whose project was never checked', () => {
      setCreds([credential('c-1', { project_verified: false })])
      renderView()

      expect(screen.getByText('banners.credentialsUnverified.title')).toBeInTheDocument()
    })

    it('shows the validation error of a failing credential', () => {
      setCreds([credential('c-1', { last_validation_error: 'bad token' })])
      renderView()

      expect(screen.getByText('banners.credentialsInvalid.title')).toBeInTheDocument()
      expect(screen.getByText('bad token')).toBeInTheDocument()
    })

    it('shows no banner before the credentials have resolved', () => {
      renderView()
      expect(screen.queryByText('banners.credentialsUnverified.title')).not.toBeInTheDocument()
      expect(screen.queryByText('banners.credentialsInvalid.title')).not.toBeInTheDocument()
    })

    it('renders quota rows with usage and colour; an unlimited quota shows ∞', () => {
      mocks.quotas.credentialId = 'c-1'
      setCreds([credential('c-1')])
      mocks.quotas.formattedQuotas = [
        { icon: () => <svg />, label: 'Instances', used: 9, limit: 10, percentage: 90, unit: '' },
        { icon: () => <svg />, label: 'Storage', used: 20, limit: null, percentage: 0, unit: 'GB' },
      ]
      renderView()

      expect(screen.getByText('9/10')).toBeInTheDocument()
      expect(screen.getByText('20/∞GB')).toBeInTheDocument()
      expect(document.querySelector('.bg-red-500')).not.toBeNull()
    })

    it('shows the skeleton on the initial load', () => {
      mocks.quotas.credentialId = 'c-1'
      setCreds([credential('c-1')])
      mocks.quotas.loading = true
      mocks.quotas.hasCachedQuotas = false
      const { container } = renderView()

      expect(container.querySelectorAll('.animate-pulse')).toHaveLength(6)
    })

    it('shows the load error when a project is chosen but no data came', () => {
      mocks.quotas.credentialId = 'c-1'
      setCreds([credential('c-1')])
      renderView()

      expect(screen.getByText('DashboardView.quotaLoadError')).toBeInTheDocument()
    })

    it('shows the courses tile', () => {
      renderView()
      expect(screen.getByRole('link', { name: /DashboardView\.courses/ })).toHaveAttribute('href', '/courses')
    })
  })

  describe('for students', () => {
    it('shows neither quota tile, banners nor reads credentials', () => {
      setCreds([credential('c-1', { project_verified: false })])
      renderView()

      expect(screen.queryByText('DashboardView.availableResources')).not.toBeInTheDocument()
      expect(screen.queryByText('banners.credentialsUnverified.title')).not.toBeInTheDocument()
      expect(fetchCredentials).not.toHaveBeenCalled()
      expect(mocks.fetchQuotas).not.toHaveBeenCalled()
    })

    it('hides the courses tile', () => {
      renderView()
      expect(screen.queryByRole('link', { name: /DashboardView\.courses/ })).not.toBeInTheDocument()
    })
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
})
