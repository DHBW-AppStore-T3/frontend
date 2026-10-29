import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { I18nextProvider } from 'react-i18next'
import type { ReactNode } from 'react'
import type { Task, DeploymentWithRelations } from '@/types'

const mocks = vi.hoisted(() => ({ getDeployment: vi.fn(), navigate: vi.fn() }))

vi.mock('@/services/keycloak.service', () => ({
  keycloak: { getState: () => ({ isAuthenticated: true }), subscribe: () => () => {} },
}))
vi.mock('@/api/deployment.api', () => ({ deploymentApi: { getById: mocks.getDeployment } }))
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useNavigate: () => mocks.navigate }))

import { useDeploymentStreamSync } from '../useDeploymentStreamSync'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToastStore } from '@/stores/toast.store'
import { keyEchoI18n } from '../../../../tests/helpers/render'

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={keyEchoI18n()}>
    <MemoryRouter>{children}</MemoryRouter>
  </I18nextProvider>
)

const task = (over: Partial<Task> = {}) => ({ taskId: 't1', type: 'deploy', status: 'running', created_at: '2026-01-01T00:00:00Z', ...over }) as Task
const deployment = { deploymentId: 'dep-1', status: 'success', permissions: { owner_view: true } } as unknown as DeploymentWithRelations

function setup(initial: { isStreamRelevant: boolean; connectionState?: string; activeTask?: Task | null; invalidEvents?: number }) {
  const start = vi.fn()
  const stop = vi.fn()
  const loadTasks = vi.fn(async () => [] as Task[])
  const loadMyAccess = vi.fn(async () => {})
  const loadResources = vi.fn(async () => {})
  const hook = renderHook(
    (props: typeof initial) =>
      useDeploymentStreamSync({
        deploymentId: 'dep-1',
        stream: { start, stop, connectionState: props.connectionState ?? 'live', invalidEvents: props.invalidEvents ?? 0 } as never,
        isStreamRelevant: props.isStreamRelevant,
        activeTask: props.activeTask ?? null,
        loadTasks,
        loadMyAccess,
        loadResources,
      }),
    { wrapper, initialProps: initial },
  )
  return { ...hook, start, stop, loadTasks, loadMyAccess, loadResources }
}

beforeEach(() => {
  vi.clearAllMocks()
  useToastStore.setState({ toasts: [] })
  useDeploymentStore.setState({ currentDeployment: deployment, error: null } as never)
  mocks.getDeployment.mockResolvedValue({ data: deployment })
})

describe('useDeploymentStreamSync', () => {
  it('starts the stream when the task becomes relevant and refreshes everything when it stops being relevant', () => {
    const { rerender, start, stop, loadTasks, loadMyAccess, loadResources } = setup({ isStreamRelevant: true })
    expect(start).toHaveBeenCalledTimes(1)

    rerender({ isStreamRelevant: false })

    expect(stop).toHaveBeenCalledTimes(1)
    expect(loadTasks).toHaveBeenCalledTimes(1)
    expect(loadMyAccess).toHaveBeenCalledTimes(1)
    expect(loadResources).toHaveBeenCalledTimes(1)
  })

  it('does nothing for a task that never was relevant', () => {
    const { start, stop, loadTasks } = setup({ isStreamRelevant: false })
    expect(start).not.toHaveBeenCalled()
    expect(stop).not.toHaveBeenCalled()
    expect(loadTasks).not.toHaveBeenCalled()
  })

  it('on the end of the stream: reloads deployment and tasks and stays when the row is still there', async () => {
    const { rerender, loadTasks } = setup({ isStreamRelevant: true, connectionState: 'live' })
    rerender({ isStreamRelevant: true, connectionState: 'ended' })

    await waitFor(() => expect(loadTasks).toHaveBeenCalled())
    expect(mocks.getDeployment).toHaveBeenCalled()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('a destroy that ends with the row gone: success toast and back to the list', async () => {
    mocks.getDeployment.mockRejectedValue({ response: { status: 404 } })
    const { rerender } = setup({ isStreamRelevant: true, connectionState: 'live', activeTask: task({ type: 'destroy' }) })
    rerender({ isStreamRelevant: true, connectionState: 'ended', activeTask: task({ type: 'destroy' }) })

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/deployments'))
    expect(useToastStore.getState().toasts.map((t) => [t.type, t.message])).toEqual([
      ['success', 'DeploymentDetailView.deleteSuccessToast'],
    ])
  })

  it('a destroy that ends with the row still there: error toast, stays for the logs', async () => {
    const destroy = task({ type: 'destroy' })
    const { rerender } = setup({ isStreamRelevant: true, connectionState: 'live', activeTask: destroy })
    rerender({ isStreamRelevant: true, connectionState: 'ended', activeTask: destroy })

    await waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1))
    expect(useToastStore.getState().toasts[0]).toMatchObject({ type: 'error', message: 'DeploymentDetailView.deleteFailedAsyncToast' })
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it.each([
    ['pause', 'DeploymentDetailView.pauseFailedAsyncToast'],
    ['resume', 'DeploymentDetailView.resumeFailedAsyncToast'],
  ])('a failed %s is reported when the stream ends', async (type, message) => {
    const failed = task({ type: type as Task['type'], status: 'failed' })
    const { rerender } = setup({ isStreamRelevant: true, connectionState: 'live', activeTask: failed })
    rerender({ isStreamRelevant: true, connectionState: 'ended', activeTask: failed })

    await waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1))
    expect(useToastStore.getState().toasts[0]).toMatchObject({ type: 'error', message })
  })

  it('an invalid event on a live stream reloads over REST, a repeat inside the window does not', async () => {
    const { rerender, loadTasks } = setup({ isStreamRelevant: true, connectionState: 'live', invalidEvents: 0 })
    rerender({ isStreamRelevant: true, connectionState: 'live', invalidEvents: 1 })
    await waitFor(() => expect(loadTasks).toHaveBeenCalledTimes(1))

    rerender({ isStreamRelevant: true, connectionState: 'live', invalidEvents: 2 })
    await new Promise((r) => setTimeout(r, 30))
    expect(loadTasks).toHaveBeenCalledTimes(1)
  })

  it('an invalid event while the stream is not live reloads nothing', async () => {
    const { rerender, loadTasks } = setup({ isStreamRelevant: true, connectionState: 'reconnecting', invalidEvents: 0 })
    rerender({ isStreamRelevant: true, connectionState: 'reconnecting', invalidEvents: 3 })
    await new Promise((r) => setTimeout(r, 30))
    expect(loadTasks).not.toHaveBeenCalled()
  })
})
