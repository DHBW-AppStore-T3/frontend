import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({ fetchDeployments: vi.fn(), fetchApps: vi.fn() }))

vi.mock('@/services/keycloak.service', () => ({
  keycloak: { getState: () => ({ isAuthenticated: true }), subscribe: () => () => {} },
}))

import DeploymentsListView from '@/views/DeploymentsListView'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useAppStore } from '@/stores/app.store'
import { useAuthStore } from '@/stores/auth.store'
import { useAdminViewStore } from '@/stores/admin-view.store'
import { renderWithProviders } from '../../helpers/render'

const deployment = (over: Record<string, unknown> = {}) => ({
  deploymentId: 'dep-1',
  appId: 'app-123',
  name: 'Dep 1',
  status: 'success',
  releaseTag: 'v1',
  created_at: '2026-06-08T15:30:00Z',
  ...over,
})

const setState = (deployments: unknown[], apps: unknown[] = [], isLoading = false) => {
  useDeploymentStore.setState({ deployments, isLoading, fetchDeployments: mocks.fetchDeployments } as any)
  useAppStore.setState({ apps, fetchApps: mocks.fetchApps } as any)
}

const renderView = () => renderWithProviders(<DeploymentsListView />)

const setUser = (userId: string, role: string) => useAuthStore.setState({ user: { userId, role } as any })
// Admin with the admin view switched on (version and runtime are visible).
const setAdminView = (userId = 'admin-1') => {
  setUser(userId, 'admin')
  useAdminViewStore.setState({ enabledByAccount: { [userId]: true } })
}

beforeEach(() => {
  vi.clearAllMocks()
  useAdminViewStore.setState({ enabledByAccount: {} })
  setUser('teacher-1', 'teacher')
  setState([])
})

describe('DeploymentsListView', () => {
  it('fetches deployments and apps on mount', () => {
    renderView()
    expect(mocks.fetchDeployments).toHaveBeenCalledTimes(1)
    expect(mocks.fetchApps).toHaveBeenCalledTimes(1)
  })

  it('shows each deployment with the name of the app it came from', () => {
    setState([deployment({ name: 'Mein Deployment' })], [{ appId: 'app-123', name: 'Mein Backend' }])
    renderView()
    expect(screen.getByText('Mein Deployment')).toBeInTheDocument()
    expect(screen.getByText('Mein Backend')).toBeInTheDocument()
  })

  it('falls back to a dash when the deployment references an unknown app', () => {
    setState([deployment({ appId: 'does-not-exist' })])
    renderView()
    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('renders the creation timestamp as a local date', () => {
    setState([deployment()])
    renderView()
    expect(screen.getByText(/08\.06\.2026/)).toBeInTheDocument()
  })

  it('orders deployments newest first regardless of server order', () => {
    setState([
      deployment({ deploymentId: 'a', name: 'Oldest', created_at: '2026-01-01T00:00:00Z' }),
      deployment({ deploymentId: 'c', name: 'Newest', created_at: '2026-12-01T00:00:00Z' }),
      deployment({ deploymentId: 'b', name: 'Middle', created_at: '2026-06-01T00:00:00Z' }),
    ])
    renderView()
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(names).toEqual(['Newest', 'Middle', 'Oldest'])
  })

  it('links each deployment to its detail route', () => {
    setState([deployment({ deploymentId: 'dep-42' })])
    renderView()
    expect(screen.getByRole('link', { name: /Dep 1/ })).toHaveAttribute('href', '/deployments/dep-42')
  })

  it('offers a route to the app catalogue when there is nothing to show', () => {
    renderView()
    expect(screen.getByText('DeploymentsView.deploymentsMissingMessage')).toBeInTheDocument()
    for (const link of screen.getAllByRole('link', { name: 'DeploymentsView.newDeployment' })) {
      expect(link).toHaveAttribute('href', '/apps')
    }
  })

  it('shows neither the empty message nor any deployment while loading', () => {
    setState([], [], true)
    renderView()
    expect(screen.queryByText('DeploymentsView.deploymentsMissingMessage')).not.toBeInTheDocument()
  })

  it('filters by lifecycle group through the tabs', async () => {
    setState([
      deployment({ deploymentId: '1', name: 'Alive', status: 'success' }),
      deployment({ deploymentId: '2', name: 'Broken', status: 'failed' }),
    ])
    renderView()
    expect(screen.getByText('Alive')).toBeInTheDocument()
    expect(screen.queryByText('Broken')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /workspace\.statusTabs\.stopped/ }))

    expect(screen.getByText('Broken')).toBeInTheDocument()
    expect(screen.queryByText('Alive')).not.toBeInTheDocument()
  })

  it('nennt je Deployment die Laufzeit als Pods', () => {
    setAdminView()
    setState([
      deployment({ deploymentId: '1', name: 'Pods A', runtime: 'kubernetes' }),
      deployment({ deploymentId: '2', name: 'Pods B', runtime: 'kubernetes' }),
    ])
    renderView()

    expect(screen.getAllByTestId('runtime-badge').map((b) => b.textContent).sort()).toEqual([
      'runtime.kubernetesShort',
      'runtime.kubernetesShort',
    ])
  })

  describe('Version und Laufzeit', () => {
    const card = () =>
      setState([deployment({ name: 'Mein Deployment', releaseTag: 'v2.1.0', runtime: 'kubernetes' })], [
        { appId: 'app-123', name: 'Mein Backend' },
      ])

    const expectOnlyBasics = () => {
      expect(screen.queryByText('v2.1.0')).not.toBeInTheDocument()
      expect(screen.queryAllByTestId('runtime-badge')).toHaveLength(0)
      expect(screen.getByText('Mein Deployment')).toBeInTheDocument()
      expect(screen.getByText('Mein Backend')).toBeInTheDocument()
      expect(screen.getByText('success')).toBeInTheDocument()
      expect(screen.getByText(/08\.06\.2026/)).toBeInTheDocument()
    }

    it.each(['teacher', 'student'])('blendet beides für die Rolle %s aus', (role) => {
      setUser('user-1', role)
      card()
      renderView()
      expectOnlyBasics()
    })

    it('blendet beides für einen Admin ohne Admin-Ansicht aus', () => {
      setUser('admin-1', 'admin')
      card()
      renderView()
      expectOnlyBasics()
    })

    it('zeigt beides für einen Admin mit Admin-Ansicht', () => {
      setAdminView()
      card()
      renderView()
      expect(screen.getByText('v2.1.0')).toBeInTheDocument()
      expect(screen.getByTestId('runtime-badge')).toHaveTextContent('runtime.kubernetesShort')
    })

    it('hält das Datum rechts, auch wenn Version und Laufzeit fehlen', () => {
      card()
      renderView()
      expect(screen.getByText(/08\.06\.2026/).closest('span')).toHaveClass('ml-auto')
    })
  })

  it('zeigt ein Deployment mit fehlgeschlagenem Redeploy unter "aktiv", eines mit laufendem unter "in Arbeit"', async () => {
    setState([
      deployment({ deploymentId: '1', name: 'Failed redeploy', status: 'redeploy_failed' }),
      deployment({ deploymentId: '2', name: 'Redeploying', status: 'redeploying' }),
    ])
    renderView()
    expect(screen.getByText('Failed redeploy')).toBeInTheDocument()
    expect(screen.queryByText('Redeploying')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /workspace\.statusTabs\.building/ }))

    expect(screen.getByText('Redeploying')).toBeInTheDocument()
  })
})
