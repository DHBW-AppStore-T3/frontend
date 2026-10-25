import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { I18nextProvider } from 'react-i18next'
import type { ReactNode } from 'react'
import type { DeploymentWithRelations } from '@/types'

const mocks = vi.hoisted(() => ({
  getDeployment: vi.fn(),
  getMyAccess: vi.fn(),
  polling: vi.fn(),
}))

vi.mock('@/services/keycloak.service', () => ({
  keycloak: { getState: () => ({ isAuthenticated: true }), subscribe: () => () => {} },
}))
vi.mock('@/api/task.api', () => ({
  taskApi: { listByDeployment: vi.fn(async () => ({ data: [] })), getById: vi.fn() },
}))
vi.mock('@/api/deployment.api', () => ({
  deploymentApi: {
    getById: mocks.getDeployment,
    getMyAccess: mocks.getMyAccess,
    listResources: vi.fn(async () => ({ data: { resources: [], workloads: [], live: true } })),
  },
}))
vi.mock('@/composables/useDeploymentStream', () => ({
  useDeploymentStream: () => ({
    progress: null, currentPhase: null, currentPhaseIndex: null, totalPhases: 11,
    phaseNames: [], liveLogs: [], totalLogCount: 0, connectionState: 'idle', lastError: null,
    start: vi.fn(), stop: vi.fn(),
  }),
}))
vi.mock('../useDeploymentStatusPolling', async (orig) => ({
  ...(await orig<typeof import('../useDeploymentStatusPolling')>()),
  useDeploymentStatusPolling: mocks.polling,
}))

import { useDeploymentDetail } from '../useDeploymentDetail'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToastStore } from '@/stores/toast.store'
import { keyEchoI18n } from '../../../../tests/helpers/render'

const MEMBER = { owner_view: false, operate: false, member: true }
const OWNER = { owner_view: true, operate: true, member: false }

const dep = (status: string, permissions = MEMBER) =>
  ({
    deploymentId: 'dep-1',
    name: 'Lab',
    status,
    permissions,
    actions: [],
    teams: [],
    latest_task: null,
    runtime: 'kubevirt-vm',
  }) as unknown as DeploymentWithRelations

function Probe() {
  return <output data-testid="location">{useLocation().pathname}</output>
}
const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={keyEchoI18n()}>
    <MemoryRouter initialEntries={['/deployments/dep-1']}>
      <Probe />
      {children}
    </MemoryRouter>
  </I18nextProvider>
)

const lastPollingArgs = () => mocks.polling.mock.calls.at(-1)![0]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.polling.mockReturnValue({ pollingState: 'polling' })
  mocks.getMyAccess.mockResolvedValue({ data: { user_accounts: null, team_vms: null } })
  useToastStore.setState({ toasts: [] } as any)
})

describe('useDeploymentDetail status polling', () => {
  it('enables polling for a student while the deployment is running', async () => {
    mocks.getDeployment.mockResolvedValue({ data: dep('running') })
    renderHook(() => useDeploymentDetail('dep-1'), { wrapper })
    await waitFor(() => expect(lastPollingArgs()).toMatchObject({ deploymentId: 'dep-1', enabled: true }))
  })

  it('keeps polling off for the owner view', async () => {
    mocks.getDeployment.mockResolvedValue({ data: dep('running', OWNER) })
    const { result } = renderHook(() => useDeploymentDetail('dep-1'), { wrapper })
    await waitFor(() => expect(result.current.deployment).not.toBeNull())
    expect(lastPollingArgs().enabled).toBe(false)
  })

  it('reloads the own access exactly once when polling ends with success', async () => {
    mocks.getDeployment.mockResolvedValue({ data: dep('running') })
    renderHook(() => useDeploymentDetail('dep-1'), { wrapper })
    await waitFor(() => expect(lastPollingArgs().enabled).toBe(true))
    await waitFor(() => expect(mocks.getMyAccess).toHaveBeenCalledTimes(1)) // initial load
    mocks.getMyAccess.mockClear()

    act(() => {
      useDeploymentStore.setState({ currentDeployment: dep('success') })
    })

    await waitFor(() => expect(mocks.getMyAccess).toHaveBeenCalledTimes(1))
    expect(lastPollingArgs().enabled).toBe(false)
  })

  it('goes back to the list with an info toast when the deployment is gone', async () => {
    mocks.getDeployment.mockResolvedValue({ data: dep('running') })
    renderHook(() => useDeploymentDetail('dep-1'), { wrapper })
    await waitFor(() => expect(lastPollingArgs().enabled).toBe(true))

    act(() => lastPollingArgs().onGone())

    expect(screen.getByTestId('location')).toHaveTextContent('/deployments')
    expect(useToastStore.getState().toasts.at(-1)).toMatchObject({
      type: 'info',
      message: 'DeploymentDetailView.statusGoneToast',
    })
  })

  it('exposes the polling state', async () => {
    mocks.polling.mockReturnValue({ pollingState: 'degraded' })
    mocks.getDeployment.mockResolvedValue({ data: dep('running') })
    const { result } = renderHook(() => useDeploymentDetail('dep-1'), { wrapper })
    expect(result.current.statusPollingState).toBe('degraded')
  })
})
