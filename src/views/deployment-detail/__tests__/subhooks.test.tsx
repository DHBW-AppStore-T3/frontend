import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { I18nextProvider } from 'react-i18next'
import type { ReactNode } from 'react'
import type { DeploymentWithRelations } from '@/types'

// The hooks that useDeploymentDetail is composed of (issue 146), each on its own.

const mocks = vi.hoisted(() => ({
  listTasks: vi.fn(),
  getTask: vi.fn(),
  getMyAccess: vi.fn(),
  getMemberAccess: vi.fn(),
  listResources: vi.fn(),
  restartWorkload: vi.fn(),
  resetWorkload: vi.fn(),
  getDeployment: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('@/services/keycloak.service', () => ({
  keycloak: { getState: () => ({ isAuthenticated: true }), subscribe: () => () => {} },
}))
vi.mock('@/api/task.api', () => ({ taskApi: { listByDeployment: mocks.listTasks, getById: mocks.getTask } }))
vi.mock('@/api/deployment.api', () => ({
  deploymentApi: {
    getById: mocks.getDeployment,
    getMyAccess: mocks.getMyAccess,
    getMemberAccess: mocks.getMemberAccess,
    listResources: mocks.listResources,
    restartWorkload: mocks.restartWorkload,
    resetWorkload: mocks.resetWorkload,
  },
}))
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useNavigate: () => mocks.navigate }))

import { useDeploymentTasks } from '../useDeploymentTasks'
import { useOwnAccess } from '../useOwnAccess'
import { useDeploymentWorkloads } from '../useDeploymentWorkloads'
import { useDeploymentLifecycle } from '../useDeploymentLifecycle'
import { lifecycleGates } from '../access'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToastStore } from '@/stores/toast.store'
import { keyEchoI18n } from '../../../../tests/helpers/render'

const OWNER = { owner_view: true, operate: true, member: false }
const MEMBER = { owner_view: false, operate: false, member: true }
const dep = (permissions = OWNER, extra: object = {}) =>
  ({ deploymentId: 'dep-1', name: 'Lab', status: 'success', permissions, actions: [], teams: [], ...extra }) as unknown as DeploymentWithRelations

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={keyEchoI18n()}>
    <MemoryRouter>{children}</MemoryRouter>
  </I18nextProvider>
)
const task = { taskId: 't1', type: 'deploy', status: 'success', created_at: '2026-01-01T00:00:00Z' }
const messages = () => useToastStore.getState().toasts.map((t) => [t.type, t.message])

beforeEach(() => {
  vi.clearAllMocks()
  useToastStore.setState({ toasts: [] })
  useDeploymentStore.setState({ currentDeployment: dep(), error: null } as never)
  mocks.listTasks.mockResolvedValue({ data: [task] })
  mocks.listResources.mockResolvedValue({ data: { workloads: [], live: true } })
})
afterEach(() => vi.useRealTimers())

describe('useDeploymentTasks', () => {
  it('loads the checked task list for an owner view', async () => {
    const { result } = renderHook(() => useDeploymentTasks('dep-1'), { wrapper })
    let list: unknown[] = []
    await act(async () => {
      list = await result.current.loadTasks()
    })
    expect(list).toHaveLength(1)
    expect(result.current.tasks).toHaveLength(1)
    expect(result.current.loadingTasks).toBe(false)
  })

  it('drops unusable entries of the list', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.listTasks.mockResolvedValue({ data: [task, { nope: true }] })
    const { result } = renderHook(() => useDeploymentTasks('dep-1'), { wrapper })
    await act(async () => void (await result.current.loadTasks()))
    expect(result.current.tasks).toHaveLength(1)
  })

  it('does not call the owner-only endpoint for a member', async () => {
    useDeploymentStore.setState({ currentDeployment: dep(MEMBER) } as never)
    const { result } = renderHook(() => useDeploymentTasks('dep-1'), { wrapper })
    await act(async () => void (await result.current.loadTasks()))
    expect(mocks.listTasks).not.toHaveBeenCalled()
    expect(result.current.tasks).toEqual([])
  })

  it('returns an empty list and stops loading when the request fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.listTasks.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useDeploymentTasks('dep-1'), { wrapper })
    let list: unknown[] = [1]
    await act(async () => {
      list = await result.current.loadTasks()
    })
    expect(list).toEqual([])
    expect(result.current.loadingTasks).toBe(false)
  })

  it('opens and closes a task', async () => {
    mocks.getTask.mockResolvedValue({ data: { ...task, logs: 'x' } })
    const { result } = renderHook(() => useDeploymentTasks('dep-1'), { wrapper })
    await act(async () => result.current.selectTask(task as never))
    expect(result.current.selectedTask).toMatchObject({ taskId: 't1', logs: 'x' })
    act(() => result.current.deselectTask())
    expect(result.current.selectedTask).toBeNull()
  })

  it.each([
    ['fails', () => mocks.getTask.mockRejectedValue(new Error('x'))],
    ['is unusable', () => mocks.getTask.mockResolvedValue({ data: { nope: 1 } })],
  ])('shows a toast and keeps nothing selected when the detail %s', async (_l, arrange) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    arrange()
    const { result } = renderHook(() => useDeploymentTasks('dep-1'), { wrapper })
    await act(async () => result.current.selectTask(task as never))
    expect(result.current.selectedTask).toBeNull()
    expect(messages()).toEqual([['error', 'DeploymentDetailView.taskDetailError']])
    expect(result.current.loadingTaskDetail).toBe(false)
  })
})

describe('useOwnAccess', () => {
  it('loads own accounts and team block for a member', async () => {
    useDeploymentStore.setState({ currentDeployment: dep(MEMBER) } as never)
    mocks.getMyAccess.mockResolvedValue({
      data: { user_accounts: { 'u.one': { username: 'u.one', ip: '1.2.3.4' } }, team_vms: { A: [] } },
    })
    const { result } = renderHook(() => useOwnAccess('dep-1', null), { wrapper })
    expect(result.current.ownAccount).toBeNull()
    await act(async () => result.current.loadMyAccess())
    expect(result.current.ownAccount?.key).toBe('u.one')
    expect(result.current.teamVms).toBeTruthy()
  })

  it('prefers team_endpoints over team_vms', async () => {
    useDeploymentStore.setState({ currentDeployment: dep(MEMBER) } as never)
    mocks.getMyAccess.mockResolvedValue({ data: { user_accounts: null, team_endpoints: { B: [] }, team_vms: { A: [] } } })
    const { result } = renderHook(() => useOwnAccess('dep-1', null), { wrapper })
    await act(async () => result.current.loadMyAccess())
    expect(Object.keys(result.current.teamVms ?? {})).toContain('B')
  })

  it('does not ask for access when the caller is no member', async () => {
    const { result } = renderHook(() => useOwnAccess('dep-1', null), { wrapper })
    await act(async () => result.current.loadMyAccess())
    expect(mocks.getMyAccess).not.toHaveBeenCalled()
  })

  it('survives a failing request', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    useDeploymentStore.setState({ currentDeployment: dep(MEMBER) } as never)
    mocks.getMyAccess.mockRejectedValue(new Error('x'))
    const { result } = renderHook(() => useOwnAccess('dep-1', null), { wrapper })
    await act(async () => result.current.loadMyAccess())
    expect(result.current.ownAccount).toBeNull()
  })

  it('reveals one member on request and keeps nothing', async () => {
    mocks.getMemberAccess.mockResolvedValue({ data: { user_accounts: { 'ann': { username: 'ann' } } } })
    const { result } = renderHook(() => useOwnAccess('dep-1', null), { wrapper })
    let hit: unknown
    await act(async () => {
      hit = await result.current.revealMemberAccess('u-ann')
    })
    expect(hit).toMatchObject({ key: 'ann' })
    expect(mocks.getMemberAccess).toHaveBeenCalledWith('dep-1', 'u-ann')
    expect(result.current.ownAccount).toBeNull()
  })
})

describe('useDeploymentWorkloads', () => {
  const noTasks = vi.fn(async () => [])

  it('loads the workloads of an owner view', async () => {
    mocks.listResources.mockResolvedValue({ data: { workloads: [{ name: 'web', phase: 'Running', ready: true }], live: false } })
    const { result } = renderHook(() => useDeploymentWorkloads('dep-1', noTasks), { wrapper })
    await act(async () => result.current.loadResources())
    expect(result.current.workloads).toHaveLength(1)
    expect(result.current.workloadsLive).toBe(false)
  })

  it('skips the cluster call for a member', async () => {
    useDeploymentStore.setState({ currentDeployment: dep(MEMBER) } as never)
    const { result } = renderHook(() => useDeploymentWorkloads('dep-1', noTasks), { wrapper })
    await act(async () => result.current.loadResources())
    expect(mocks.listResources).not.toHaveBeenCalled()
  })

  it('empties the list on 404 (soft-deleted) without an error', async () => {
    mocks.listResources.mockResolvedValueOnce({ data: { workloads: [{ name: 'web', phase: 'Running', ready: true }], live: true } })
    const { result } = renderHook(() => useDeploymentWorkloads('dep-1', noTasks), { wrapper })
    await act(async () => result.current.loadResources())
    mocks.listResources.mockRejectedValueOnce({ response: { status: 404 } })
    await act(async () => result.current.loadResources())
    expect(result.current.workloads).toEqual([])
    expect(result.current.resourcesError).toBeNull()
  })

  it('reports another failure with its message, or a fallback', async () => {
    const { result } = renderHook(() => useDeploymentWorkloads('dep-1', noTasks), { wrapper })
    mocks.listResources.mockRejectedValueOnce({ response: { status: 500 }, message: 'cluster down' })
    await act(async () => result.current.loadResources())
    expect(result.current.resourcesError).toBe('cluster down')
    mocks.listResources.mockRejectedValueOnce({ response: { status: 500 } })
    await act(async () => result.current.loadResources())
    expect(result.current.resourcesError).toBe('pods.loadFailed')
  })

  it('asks the cluster again every 10 s while a workload is still starting, and stops when it is ready', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    mocks.listResources.mockResolvedValueOnce({ data: { workloads: [{ name: 'web', phase: 'Pending', ready: false }], live: true } })
    const { result } = renderHook(() => useDeploymentWorkloads('dep-1', noTasks), { wrapper })
    await act(async () => result.current.loadResources())
    mocks.listResources.mockClear()
    mocks.listResources.mockResolvedValue({ data: { workloads: [{ name: 'web', phase: 'Running', ready: true }], live: true } })

    await act(async () => void vi.advanceTimersByTime(10_000))
    await waitFor(() => expect(result.current.workloads[0]?.ready).toBe(true))
    expect(mocks.listResources).toHaveBeenCalledTimes(1)

    await act(async () => void vi.advanceTimersByTime(30_000))
    expect(mocks.listResources).toHaveBeenCalledTimes(1)
  })

  it('restarts a workload: calls the API, toasts, reloads deployment and tasks, frees the busy flag', async () => {
    mocks.restartWorkload.mockResolvedValue({})
    mocks.getDeployment.mockResolvedValue({ data: dep() })
    const loadTasks = vi.fn(async () => [])
    const { result } = renderHook(() => useDeploymentWorkloads('dep-1', loadTasks), { wrapper })
    await act(async () => result.current.restartWorkload('web'))
    expect(mocks.restartWorkload).toHaveBeenCalledWith('dep-1', 'web')
    expect(messages()[0]).toEqual(['success', 'pods.restartStarted'])
    expect(loadTasks).toHaveBeenCalled()
    expect(result.current.workloadBusy.size).toBe(0)
  })

  it('shows the busy message for a 409 without reason, another message for other errors', async () => {
    mocks.getDeployment.mockResolvedValue({ data: dep() })
    const { result } = renderHook(() => useDeploymentWorkloads('dep-1', noTasks), { wrapper })
    mocks.restartWorkload.mockRejectedValueOnce({ response: { status: 409, data: {} } })
    await act(async () => result.current.restartWorkload('web'))
    expect(messages().at(-1)).toEqual(['error', 'DeploymentDetailView.lifecycleBusy'])
    mocks.restartWorkload.mockRejectedValueOnce({ response: { status: 500, data: {} } })
    await act(async () => result.current.restartWorkload('web'))
    expect(messages().at(-1)?.[0]).toBe('error')
    expect(messages().at(-1)?.[1]).not.toBe('DeploymentDetailView.lifecycleBusy')
  })

  it('resets only after the question: ask opens the modal, confirm resets and closes it', async () => {
    mocks.resetWorkload.mockResolvedValue({})
    mocks.getDeployment.mockResolvedValue({ data: dep() })
    const { result } = renderHook(() => useDeploymentWorkloads('dep-1', noTasks), { wrapper })
    act(() => result.current.askResetWorkload('db'))
    expect(result.current.showResetModal).toBe(true)
    expect(result.current.resetTargetWorkload).toBe('db')
    expect(mocks.resetWorkload).not.toHaveBeenCalled()

    await act(async () => result.current.confirmResetWorkload())

    expect(mocks.resetWorkload).toHaveBeenCalledWith('dep-1', 'db')
    expect(result.current.showResetModal).toBe(false)
    expect(result.current.resetTargetWorkload).toBeNull()
  })

  it('confirming without a target does nothing', async () => {
    const { result } = renderHook(() => useDeploymentWorkloads('dep-1', noTasks), { wrapper })
    await act(async () => result.current.confirmResetWorkload())
    expect(mocks.resetWorkload).not.toHaveBeenCalled()
  })
})

describe('useDeploymentLifecycle', () => {
  const gates = (extra: object = {}) =>
    lifecycleGates(dep(OWNER, { actions: ['cancel', 'delete', 'pause', 'resume'], ...extra }))
  const setup = (g = gates()) => {
    const loadTasks = vi.fn(async () => [])
    const hook = renderHook(() => useDeploymentLifecycle('dep-1', g, loadTasks), { wrapper })
    return { ...hook, loadTasks }
  }
  const store = (patch: object) => useDeploymentStore.setState(patch as never)

  it('exposes the gates and a reason when delete is unavailable', () => {
    const { result } = setup(lifecycleGates(dep(OWNER, { actions: [] })))
    expect(result.current.canDelete).toBe(false)
    expect(result.current.deleteDisabledReason).toBe('DeploymentDetailView.deleteUnavailable')
  })

  it('cancel: closes the modal, toasts and reloads; a second call while busy is ignored', async () => {
    const cancel = vi.fn().mockResolvedValue({})
    store({ cancelDeployment: cancel })
    mocks.getDeployment.mockResolvedValue({ data: dep() })
    const { result, loadTasks } = setup()
    act(() => result.current.setShowCancelModal(true))
    await act(async () => result.current.confirmCancel())
    expect(cancel).toHaveBeenCalledWith('dep-1')
    expect(result.current.showCancelModal).toBe(false)
    expect(messages()[0]).toEqual(['info', 'DeploymentDetailView.stopStartedToast'])
    expect(loadTasks).toHaveBeenCalled()
    expect(result.current.cancelBusy).toBe(false)
  })

  it('cancel failure: error toast, modal stays', async () => {
    store({ cancelDeployment: vi.fn().mockRejectedValue({ response: { status: 500, data: {} } }) })
    const { result } = setup()
    act(() => result.current.setShowCancelModal(true))
    await act(async () => result.current.confirmCancel())
    expect(messages()[0]?.[0]).toBe('error')
    expect(result.current.showCancelModal).toBe(true)
    expect(result.current.cancelBusy).toBe(false)
  })

  it('delete 202: stays and reloads; 204: leaves for the list', async () => {
    mocks.getDeployment.mockResolvedValue({ data: dep() })
    const del = vi.fn().mockResolvedValueOnce({ status: 202 }).mockResolvedValueOnce({ status: 204 })
    store({ deleteDeployment: del })
    const { result, loadTasks } = setup()

    await act(async () => result.current.confirmDelete())
    expect(messages().at(-1)).toEqual(['info', 'DeploymentDetailView.deleteStartedToast'])
    expect(loadTasks).toHaveBeenCalled()
    expect(mocks.navigate).not.toHaveBeenCalled()

    await act(async () => result.current.confirmDelete())
    expect(messages().at(-1)).toEqual(['success', 'DeploymentDetailView.deleteSuccessToast'])
    expect(mocks.navigate).toHaveBeenCalledWith('/deployments')
    expect(result.current.showDeleteModal).toBe(false)
  })

  it('delete failure: error toast with the reason, modal closes', async () => {
    store({ deleteDeployment: vi.fn().mockRejectedValue({ response: { data: { detail: 'locked' } } }) })
    const { result } = setup()
    act(() => result.current.setShowDeleteModal(true))
    await act(async () => result.current.confirmDelete())
    expect(messages()[0]?.[1]).toContain('DeploymentDetailView.deleteErrorToast')
    expect(messages()[0]?.[1]).toContain('locked')
    expect(result.current.showDeleteModal).toBe(false)
  })

  it('pause or resume follows the gate, and does nothing when no action applies', async () => {
    mocks.getDeployment.mockResolvedValue({ data: dep() })
    const pause = vi.fn().mockResolvedValue({})
    store({ pauseDeployment: pause })
    const { result } = setup(gates({ status: 'success' }))
    expect(result.current.pauseResumeAction).toBe('pause')
    await act(async () => result.current.confirmPauseResume())
    expect(pause).toHaveBeenCalledWith('dep-1')
    expect(messages()[0]).toEqual(['info', 'DeploymentDetailView.pauseStartedToast'])
    expect(result.current.showPauseResumeModal).toBe(false)

    const idle = setup(lifecycleGates(dep(OWNER, { actions: [] })))
    await act(async () => idle.result.current.confirmPauseResume())
    expect(pause).toHaveBeenCalledTimes(1)
  })

  it('resume failure: error toast, busy flag released', async () => {
    const resume = vi.fn().mockRejectedValue({ response: { status: 500, data: {} } })
    store({ resumeDeployment: resume })
    const { result } = setup(gates({ status: 'paused' }))
    expect(result.current.pauseResumeAction).toBe('resume')
    await act(async () => result.current.confirmPauseResume())
    expect(messages()[0]?.[1]).toContain('DeploymentDetailView.resumeErrorToast')
    expect(result.current.pauseResumeBusy).toBe(false)
  })
})
