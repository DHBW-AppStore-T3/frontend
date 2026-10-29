import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen } from '@testing-library/react'

// Stats are a separate, individually tested unit; here they are driven
// directly so the view's wiring and rendering can be asserted.
const mocks = vi.hoisted(() => ({
  fetchStats: vi.fn(() => Promise.resolve()),
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
import DashboardView from '@/views/DashboardView'
import { useAuthStore } from '@/stores/auth.store'
import i18n from '@/i18n'
import { renderWithProviders } from '../../helpers/render'

const setUser = (user: Record<string, unknown> | null) => useAuthStore.setState({ user } as any)

const renderView = () => renderWithProviders(<DashboardView />)

describe('DashboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setUser({ username: 'john', role: 'student' })
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

  describe('for staff', () => {
    it('shows the courses tile', () => {
      setUser({ username: 'john', role: 'teacher' })
      renderView()
      expect(screen.getByRole('link', { name: /DashboardView\.courses/ })).toHaveAttribute('href', '/courses')
    })
  })

  describe('for students', () => {
    it('hides the courses tile', () => {
      renderView()
      expect(screen.queryByRole('link', { name: /DashboardView\.courses/ })).not.toBeInTheDocument()
    })
  })

  describe('greeting (real German copy)', () => {
    const renderDe = async () => {
      await i18n.changeLanguage('de')
      return renderWithProviders(<DashboardView />, { realI18n: true })
    }

    it('greets the user by first name', async () => {
      setUser({ username: 'dozent.demo', firstName: 'Dozentin' })
      await renderDe()
      expect(screen.getByRole('heading', { level: 1, name: 'Hallo Dozentin' })).toBeInTheDocument()
    })

    it('falls back to the capitalised username without a first name', async () => {
      setUser({ username: 'dozent.demo', firstName: '  ' })
      await renderDe()
      expect(screen.getByRole('heading', { level: 1, name: 'Hallo Dozent.demo' })).toBeInTheDocument()
    })

    it('greets without a name when no user is loaded yet', async () => {
      setUser(null)
      await renderDe()
      expect(screen.getByRole('heading', { level: 1, name: 'Hallo' })).toBeInTheDocument()
    })

    it('renders no eyebrow in the hero banner', async () => {
      const { container } = await renderDe()
      expect(container.querySelector('.page-eyebrow')).toBeNull()
    })
  })

  it('shows the KPI numbers and links', () => {
    renderView()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /DashboardView\.deployments/ })).toHaveAttribute('href', '/deployments')
    expect(screen.getByRole('link', { name: /DashboardView\.apps/ })).toHaveAttribute('href', '/apps')
  })
})
