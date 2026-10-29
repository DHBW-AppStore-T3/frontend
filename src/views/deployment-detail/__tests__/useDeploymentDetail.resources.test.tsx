import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { I18nextProvider } from 'react-i18next'
import type { ReactNode } from 'react'
import type { DeploymentWithRelations } from '@/types'

const mocks = vi.hoisted(() => ({
  getDeployment: vi.fn(),
  listResources: vi.fn(),
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
    getMyAccess: vi.fn(async () => ({ data: { user_accounts: null, team_vms: null } })),
    listResources: mocks.listResources,
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
  useDeploymentStatusPolling: () => ({ pollingState: 'idle' }),
}))

import { useDeploymentDetail } from '../useDeploymentDetail'
import { keyEchoI18n } from '../../../../tests/helpers/render'

const OWNER = { owner_view: true, operate: true, member: false }

const dep = () =>
  ({
    deploymentId: 'dep-1',
    name: 'Lab',
    status: 'success',
    permissions: OWNER,
    actions: [],
    teams: [],
    latest_task: null,
    runtime: 'kubernetes',
  }) as unknown as DeploymentWithRelations

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={keyEchoI18n()}>
    <MemoryRouter initialEntries={['/deployments/dep-1']}>{children}</MemoryRouter>
  </I18nextProvider>
)

async function loadResourcesWith(rejection: unknown) {
  mocks.getDeployment.mockResolvedValue({ data: dep() })
  const { result } = renderHook(() => useDeploymentDetail('dep-1'), { wrapper })
  await waitFor(() => expect(result.current.deployment).not.toBeNull())
  mocks.listResources.mockReset()
  mocks.listResources.mockRejectedValue(rejection)
  await act(async () => {
    await result.current.loadResources()
  })
  return result
}

// The error path of the workload list: what the person sees depends on what the error carries.
describe('useDeploymentDetail loadResources errors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listResources.mockResolvedValue({ data: { live: true, runtime: 'kubernetes', workloads: [] } })
  })

  it('shows the error message of the error', async () => {
    const result = await loadResourcesWith(new Error('cluster unreachable'))
    expect(result.current.resourcesError).toBe('cluster unreachable')
  })

  it('falls back to the translated text when the error has no message', async () => {
    const result = await loadResourcesWith({})
    expect(result.current.resourcesError).toBe('pods.loadFailed')
  })

  it('falls back to the translated text when the thrown value is null', async () => {
    const result = await loadResourcesWith(null)
    expect(result.current.resourcesError).toBe('pods.loadFailed')
  })

  it('treats a 404 as "workloads gone": empty list, no error', async () => {
    const result = await loadResourcesWith({ response: { status: 404 }, message: 'Not Found' })
    expect(result.current.resourcesError).toBeNull()
    expect(result.current.workloads).toEqual([])
  })
})
