import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { I18nextProvider } from 'react-i18next'
import type { ReactNode } from 'react'
import type { DeploymentWithRelations } from '@/types'

const mocks = vi.hoisted(() => ({
  getDeployment: vi.fn(),
  listTasks: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  stream: {
    progress: null as number | null,
    currentPhase: null as string | null,
    currentPhaseIndex: null as number | null,
    totalPhases: 11,
    phaseNames: [] as string[],
    liveLogs: [] as unknown[],
    totalLogCount: 0,
    connectionState: 'live' as string,
    lastError: null as string | null,
    invalidEvents: 0,
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
import { keyEchoI18n } from '../../../../tests/helpers/render'

const OWNER = { owner_view: true, operate: true, member: false }
const MEMBER = { owner_view: false, operate: false, member: true }
const WINDOW_MS = 15_000

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

const liveTask = { taskId: 't-1', type: 'deploy', status: 'running', created_at: '2026-01-01T00:00:00Z' }

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={keyEchoI18n()}>
    <MemoryRouter initialEntries={['/deployments/dep-1']}>{children}</MemoryRouter>
  </I18nextProvider>
)

const deferred = <T,>() => {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Only Date is faked: waitFor and promises keep working, the 15 s window is controlled.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-06-01T12:00:00Z'))
  Object.assign(mocks.stream, { connectionState: 'live', invalidEvents: 0 })
  mocks.getDeployment.mockImplementation(async (id: string) => ({ data: dep(OWNER, id) }))
  mocks.listTasks.mockResolvedValue({ data: [liveTask] })
  useDeploymentStore.setState({ currentDeployment: null, error: null } as never)
})
afterEach(() => {
  vi.useRealTimers()
})

async function renderSettled(permissions = OWNER, id = 'dep-1') {
  mocks.getDeployment.mockImplementation(async (depId: string) => ({ data: dep(permissions, depId) }))
  const view = renderHook(({ id: depId }) => useDeploymentDetail(depId), { wrapper, initialProps: { id } })
  await waitFor(() => expect(view.result.current.deployment).not.toBeNull())
  if (permissions.owner_view) await waitFor(() => expect(view.result.current.tasks).toHaveLength(1))
  // let the trailing initial-load calls (my-access, resources) settle
  await new Promise((r) => setTimeout(r, 20))
  return view
}

const flushAsync = () => new Promise((r) => setTimeout(r, 20))

function reportInvalid(view: { rerender: (p: { id: string }) => void }, count: number, id = 'dep-1') {
  mocks.stream.invalidEvents = count
  view.rerender({ id })
}

describe('useDeploymentDetail: REST resync on invalid SSE events', () => {
  it('reloads deployment and tasks when invalid events show up on a live stream', async () => {
    const view = await renderSettled()
    const deploymentCalls = mocks.getDeployment.mock.calls.length
    const taskCalls = mocks.listTasks.mock.calls.length

    reportInvalid(view, 1)

    await waitFor(() => expect(mocks.getDeployment.mock.calls.length).toBe(deploymentCalls + 1))
    await waitFor(() => expect(mocks.listTasks.mock.calls.length).toBe(taskCalls + 1))
    expect(mocks.getDeployment).toHaveBeenLastCalledWith('dep-1')
    expect(mocks.listTasks).toHaveBeenLastCalledWith('dep-1')
  })

  it('does not reload anything while no invalid event was seen', async () => {
    const view = await renderSettled()
    const deploymentCalls = mocks.getDeployment.mock.calls.length
    const taskCalls = mocks.listTasks.mock.calls.length

    for (let i = 0; i < 3; i++) view.rerender({ id: 'dep-1' })
    vi.setSystemTime(Date.now() + 10 * WINDOW_MS)
    view.rerender({ id: 'dep-1' })
    await flushAsync()

    expect(mocks.getDeployment.mock.calls.length).toBe(deploymentCalls)
    expect(mocks.listTasks.mock.calls.length).toBe(taskCalls)
  })

  it('resyncs at most once within 15 seconds however many invalid events arrive', async () => {
    const view = await renderSettled()
    const deploymentCalls = mocks.getDeployment.mock.calls.length

    reportInvalid(view, 1)
    await waitFor(() => expect(mocks.getDeployment.mock.calls.length).toBe(deploymentCalls + 1))

    for (const n of [2, 3, 4, 5]) {
      vi.setSystemTime(Date.now() + 2_000)
      reportInvalid(view, n)
    }
    await flushAsync()

    expect(mocks.getDeployment.mock.calls.length).toBe(deploymentCalls + 1)
  })

  it('resyncs again for an invalid event after the window has passed', async () => {
    const view = await renderSettled()
    const deploymentCalls = mocks.getDeployment.mock.calls.length

    reportInvalid(view, 1)
    await waitFor(() => expect(mocks.getDeployment.mock.calls.length).toBe(deploymentCalls + 1))

    vi.setSystemTime(Date.now() + WINDOW_MS - 1)
    reportInvalid(view, 2)
    await flushAsync()
    expect(mocks.getDeployment.mock.calls.length).toBe(deploymentCalls + 1)

    vi.setSystemTime(Date.now() + 1)
    reportInvalid(view, 3)
    await waitFor(() => expect(mocks.getDeployment.mock.calls.length).toBe(deploymentCalls + 2))
  })

  it('does not resync because of a state change when no new invalid event arrived', async () => {
    const view = await renderSettled()
    const deploymentCalls = mocks.getDeployment.mock.calls.length
    reportInvalid(view, 1)
    await waitFor(() => expect(mocks.getDeployment.mock.calls.length).toBe(deploymentCalls + 1))

    // reconnecting -> live again with the same counter, long after the window
    vi.setSystemTime(Date.now() + 5 * WINDOW_MS)
    mocks.stream.connectionState = 'reconnecting'
    view.rerender({ id: 'dep-1' })
    mocks.stream.connectionState = 'live'
    view.rerender({ id: 'dep-1' })
    await flushAsync()

    expect(mocks.getDeployment.mock.calls.length).toBe(deploymentCalls + 1)
  })

  it('treats a counter reset by a new stream as fresh, but still honours the window', async () => {
    const view = await renderSettled()
    const deploymentCalls = mocks.getDeployment.mock.calls.length
    reportInvalid(view, 1)
    await waitFor(() => expect(mocks.getDeployment.mock.calls.length).toBe(deploymentCalls + 1))

    reportInvalid(view, 0)
    reportInvalid(view, 1) // new stream, new invalid event, inside the window
    await flushAsync()
    expect(mocks.getDeployment.mock.calls.length).toBe(deploymentCalls + 1)

    vi.setSystemTime(Date.now() + WINDOW_MS)
    reportInvalid(view, 0)
    reportInvalid(view, 1)
    await waitFor(() => expect(mocks.getDeployment.mock.calls.length).toBe(deploymentCalls + 2))
  })

  it.each(['connecting', 'reconnecting', 'idle', 'error'])('does not resync while the stream is %s', async (state) => {
    const view = await renderSettled()
    const deploymentCalls = mocks.getDeployment.mock.calls.length

    mocks.stream.connectionState = state
    reportInvalid(view, 1)
    await flushAsync()

    expect(mocks.getDeployment.mock.calls.length).toBe(deploymentCalls)
  })

  it('does not add a resync once the stream has ended; only the ended reload runs', async () => {
    const view = await renderSettled()
    const deploymentCalls = mocks.getDeployment.mock.calls.length
    const taskCalls = mocks.listTasks.mock.calls.length

    mocks.stream.connectionState = 'ended'
    reportInvalid(view, 3)
    await waitFor(() => expect(mocks.getDeployment.mock.calls.length).toBe(deploymentCalls + 1))
    await flushAsync()

    expect(mocks.getDeployment.mock.calls.length).toBe(deploymentCalls + 1)
    expect(mocks.listTasks.mock.calls.length).toBe(taskCalls + 1)
  })

  it('does not resync when the stream is not relevant (task already finished)', async () => {
    mocks.listTasks.mockResolvedValue({ data: [{ ...liveTask, status: 'success' }] })
    const view = await renderSettled()
    const deploymentCalls = mocks.getDeployment.mock.calls.length

    reportInvalid(view, 1)
    await flushAsync()

    expect(mocks.getDeployment.mock.calls.length).toBe(deploymentCalls)
  })

  it('skips the task request when the view is unmounted while the deployment reload is in flight', async () => {
    const view = await renderSettled()
    const taskCalls = mocks.listTasks.mock.calls.length
    const slow = deferred<{ data: DeploymentWithRelations }>()
    mocks.getDeployment.mockImplementationOnce(() => slow.promise)

    reportInvalid(view, 1)
    await waitFor(() => expect(mocks.getDeployment).toHaveBeenCalledTimes(2))
    view.unmount()
    slow.resolve({ data: dep() })
    await flushAsync()

    expect(mocks.listTasks.mock.calls.length).toBe(taskCalls)
  })

  it('skips the task request when the stream ended while the deployment reload is in flight', async () => {
    const view = await renderSettled()
    const slow = deferred<{ data: DeploymentWithRelations }>()
    mocks.getDeployment.mockImplementationOnce(() => slow.promise)

    reportInvalid(view, 1)
    await waitFor(() => expect(mocks.getDeployment).toHaveBeenCalledTimes(2))
    const taskCalls = mocks.listTasks.mock.calls.length
    mocks.stream.connectionState = 'ended'
    mocks.getDeployment.mockImplementation(async () => ({ data: dep() }))
    view.rerender({ id: 'dep-1' }) // ended reload fetches itself and loads tasks once
    await waitFor(() => expect(mocks.listTasks.mock.calls.length).toBe(taskCalls + 1))
    slow.resolve({ data: dep() })
    await flushAsync()

    expect(mocks.listTasks.mock.calls.length).toBe(taskCalls + 1)
  })

  it('does not reload tasks for the old deployment after the id changed', async () => {
    const view = await renderSettled()
    const slow = deferred<{ data: DeploymentWithRelations }>()
    mocks.getDeployment.mockImplementationOnce(() => slow.promise)

    reportInvalid(view, 1)
    await waitFor(() => expect(mocks.getDeployment).toHaveBeenCalledTimes(2))
    mocks.stream.invalidEvents = 0
    view.rerender({ id: 'dep-2' })
    await flushAsync()
    const oldIdTaskCalls = () => mocks.listTasks.mock.calls.filter((c) => c[0] === 'dep-1').length
    const before = oldIdTaskCalls()
    slow.resolve({ data: dep() })
    await flushAsync()

    expect(oldIdTaskCalls()).toBe(before)
  })

  it('does not overlap with a resync that is still running', async () => {
    const view = await renderSettled()
    const deploymentCalls = mocks.getDeployment.mock.calls.length
    const slow = deferred<{ data: DeploymentWithRelations }>()
    mocks.getDeployment.mockImplementationOnce(() => slow.promise)

    reportInvalid(view, 1)
    await waitFor(() => expect(mocks.getDeployment.mock.calls.length).toBe(deploymentCalls + 1))
    vi.setSystemTime(Date.now() + 3 * WINDOW_MS) // window long over, request still pending
    reportInvalid(view, 2)
    await flushAsync()

    expect(mocks.getDeployment.mock.calls.length).toBe(deploymentCalls + 1)
    slow.resolve({ data: dep() })
    await flushAsync()
  })

  it('never calls the owner-only task endpoint for a member, even with invalid events', async () => {
    const view = await renderSettled(MEMBER)
    const taskCalls = mocks.listTasks.mock.calls.length

    reportInvalid(view, 5)
    await flushAsync()

    expect(mocks.start).not.toHaveBeenCalled()
    expect(mocks.listTasks.mock.calls.length).toBe(taskCalls)
    expect(mocks.listTasks).not.toHaveBeenCalled()
  })
})
