import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { I18nextProvider } from 'react-i18next'
import type { ReactNode } from 'react'
import type { DeploymentWithRelations } from '@/types'

const mocks = vi.hoisted(() => ({
  getDeployment: vi.fn(),
  listTasks: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  // The stream is a controllable stand-in: tests change `stream` and rerender.
  stream: {
    progress: null as number | null,
    currentPhase: null as string | null,
    currentPhaseIndex: null as number | null,
    totalPhases: 11,
    phaseNames: [] as string[],
    liveLogs: [] as unknown[],
    totalLogCount: 0,
    connectionState: 'idle' as string,
    lastError: null as string | null,
  },
}))

vi.mock('@/services/keycloak.service', () => ({
  keycloak: { getState: () => ({ isAuthenticated: true }), subscribe: () => () => {} },
}))
vi.mock('@/api/task.api', () => ({
  taskApi: { listByDeployment: mocks.listTasks, getById: vi.fn() },
}))
vi.mock('@/api/deployment.api', () => ({
  deploymentApi: {
    getById: mocks.getDeployment,
    getMyAccess: vi.fn(async () => ({ data: { user_accounts: null, team_vms: null } })),
    listResources: vi.fn(async () => ({ data: { resources: [], workloads: [], live: true } })),
  },
}))
vi.mock('@/composables/useDeploymentStream', () => ({
  useDeploymentStream: () => ({ ...mocks.stream, start: mocks.start, stop: mocks.stop }),
}))
vi.mock('../useDeploymentStatusPolling', async (orig) => ({
  ...(await orig<typeof import('../useDeploymentStatusPolling')>()),
  useDeploymentStatusPolling: () => ({ pollingState: 'idle' }),
}))

import { useDeploymentDetail } from '../useDeploymentDetail'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToastStore } from '@/stores/toast.store'
import { keyEchoI18n } from '../../../../tests/helpers/render'

const OWNER = { owner_view: true, operate: true, member: false }
const MEMBER = { owner_view: false, operate: false, member: true }

const dep = (permissions = OWNER, id = 'dep-1') =>
  ({
    deploymentId: id,
    name: 'Lab',
    status: 'running',
    permissions,
    actions: [],
    teams: [],
    latest_task: null,
    runtime: 'kubernetes',
  }) as unknown as DeploymentWithRelations

const task = (type: string, status: string, createdAt = '2026-01-01T00:00:00Z') => ({
  taskId: `${type}-${status}`,
  type,
  status,
  created_at: createdAt,
})

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

const notFound = () => Object.assign(new Error('not found'), { response: { status: 404 } })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.stream.connectionState = 'idle'
  mocks.stream.progress = null
  mocks.listTasks.mockResolvedValue({ data: [] })
  useDeploymentStore.setState({ currentDeployment: null, error: null } as never)
  useToastStore.setState({ toasts: [] } as never)
})

/** Renders the hook once the initial load settled, with an active task of the given kind. */
async function renderSettled(tasks: unknown[], permissions = OWNER) {
  mocks.getDeployment.mockResolvedValue({ data: dep(permissions) })
  mocks.listTasks.mockResolvedValue({ data: tasks })
  const view = renderHook(() => useDeploymentDetail('dep-1'), { wrapper })
  await waitFor(() => expect(view.result.current.deployment).not.toBeNull())
  if (permissions.owner_view) await waitFor(() => expect(view.result.current.tasks.length).toBe(tasks.length))
  await waitFor(() => expect(mocks.getDeployment).toHaveBeenCalled())
  return view
}

const toastTypes = () => useToastStore.getState().toasts.map((x) => `${x.type}:${x.message}`)

describe('useDeploymentDetail: stream end reload', () => {
  it('starts the stream for an owner while the latest task is live', async () => {
    await renderSettled([task('deploy', 'running')])
    await waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(1))
  })

  it('reloads deployment and tasks once when the stream ends', async () => {
    const view = await renderSettled([task('deploy', 'running')])
    const deploymentCalls = mocks.getDeployment.mock.calls.length
    const taskCalls = mocks.listTasks.mock.calls.length

    mocks.stream.connectionState = 'ended'
    view.rerender()

    await waitFor(() => expect(mocks.getDeployment.mock.calls.length).toBe(deploymentCalls + 1))
    await waitFor(() => expect(mocks.listTasks.mock.calls.length).toBe(taskCalls + 1))
  })

  it('does not reload while the stream is merely live or connecting', async () => {
    const view = await renderSettled([task('deploy', 'running')])
    const deploymentCalls = mocks.getDeployment.mock.calls.length

    for (const state of ['connecting', 'live', 'reconnecting']) {
      mocks.stream.connectionState = state
      view.rerender()
    }
    await new Promise((r) => setTimeout(r, 20))

    expect(mocks.getDeployment.mock.calls.length).toBe(deploymentCalls)
  })

  it('navigates to the list with a success toast when a destroy removed the row', async () => {
    const view = await renderSettled([task('destroy', 'running')])
    mocks.getDeployment.mockRejectedValueOnce(notFound())

    mocks.stream.connectionState = 'ended'
    view.rerender()

    await waitFor(() => expect(toastTypes()).toContain('success:DeploymentDetailView.deleteSuccessToast'))
  })

  it('shows the async-failure toast when a destroy ended but the row still exists', async () => {
    const view = await renderSettled([task('destroy', 'running')])

    mocks.stream.connectionState = 'ended'
    view.rerender()

    await waitFor(() => expect(toastTypes()).toContain('error:DeploymentDetailView.deleteFailedAsyncToast'))
  })

  it.each([
    ['pause', 'DeploymentDetailView.pauseFailedAsyncToast'],
    ['resume', 'DeploymentDetailView.resumeFailedAsyncToast'],
  ])('toasts a failed %s found in the reloaded tasks', async (kind, key) => {
    const view = await renderSettled([task(kind, 'running', '2026-01-02T00:00:00Z')])
    mocks.listTasks.mockResolvedValue({ data: [task(kind, 'failed', '2026-01-02T00:00:00Z')] })

    mocks.stream.connectionState = 'ended'
    view.rerender()

    await waitFor(() => expect(toastTypes()).toContain(`error:${key}`))
  })

  it('shows no toast when an ordinary deploy ended', async () => {
    const view = await renderSettled([task('deploy', 'running')])
    mocks.listTasks.mockResolvedValue({ data: [task('deploy', 'success')] })

    mocks.stream.connectionState = 'ended'
    view.rerender()
    await waitFor(() => expect(mocks.listTasks.mock.calls.length).toBeGreaterThan(1))

    expect(toastTypes()).toEqual([])
  })
})

describe('useDeploymentDetail: members and the stream', () => {
  it('never starts the stream and never asks for tasks for a member', async () => {
    await renderSettled([], MEMBER)
    await new Promise((r) => setTimeout(r, 20))

    expect(mocks.start).not.toHaveBeenCalled()
    expect(mocks.listTasks).not.toHaveBeenCalled()
  })
})
