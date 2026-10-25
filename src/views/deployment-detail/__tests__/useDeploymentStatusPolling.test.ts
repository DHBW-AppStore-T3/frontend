import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { DeploymentWithRelations } from '@/types'

const getById = vi.hoisted(() => vi.fn())
vi.mock('@/api/deployment.api', () => ({ deploymentApi: { getById } }))

import {
  useDeploymentStatusPolling,
  shouldPollDeploymentStatus,
  STATUS_POLL_INTERVAL_MS,
  STATUS_POLL_MAX_DELAY_MS,
} from '../useDeploymentStatusPolling'
import { useDeploymentStore } from '@/stores/deployment.store'

const dep = (overrides: Partial<DeploymentWithRelations> = {}) =>
  ({
    deploymentId: 'dep-1',
    name: 'Lab',
    status: 'running',
    permissions: { owner_view: false, operate: false, member: true },
    latest_task: null,
    ...overrides,
  }) as DeploymentWithRelations

const reply = (d: DeploymentWithRelations) => Promise.resolve({ data: d })
const httpError = (status: number) => Promise.reject({ response: { status } })

const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

const mount = (props: Partial<{ deploymentId: string; enabled: boolean }> = {}) => {
  const onGone = vi.fn()
  const view = renderHook(
    (p: { deploymentId: string; enabled: boolean }) => useDeploymentStatusPolling({ ...p, onGone }),
    { initialProps: { deploymentId: 'dep-1', enabled: true, ...props } },
  )
  return { ...view, onGone }
}

beforeEach(() => {
  vi.useFakeTimers()
  getById.mockReset()
  useDeploymentStore.setState({ currentDeployment: dep(), isLoading: false, error: null })
})

afterEach(() => {
  setHidden(false)
  vi.useRealTimers()
})

describe('shouldPollDeploymentStatus', () => {
  it('polls a live deployment for a member who is not the owner view', () => {
    expect(shouldPollDeploymentStatus(dep())).toBe(true)
    expect(shouldPollDeploymentStatus(dep({ status: 'pending' }))).toBe(true)
  })

  it('does not poll owner views, finished deployments or no deployment', () => {
    const owner = { owner_view: true, operate: true, member: true }
    expect(shouldPollDeploymentStatus(dep({ permissions: owner }))).toBe(false)
    expect(shouldPollDeploymentStatus(dep({ status: 'success' }))).toBe(false)
    expect(shouldPollDeploymentStatus(null)).toBe(false)
  })
})

describe('useDeploymentStatusPolling', () => {
  it('sends no request while disabled', async () => {
    mount({ enabled: false })
    await tick(60_000)
    expect(getById).not.toHaveBeenCalled()
  })

  it('asks once after the interval, with a signal, and stores the answer', async () => {
    getById.mockImplementation(() =>
      reply(dep({ status: 'running', latest_task: { status: 'running' } as any })),
    )
    mount()
    await tick(STATUS_POLL_INTERVAL_MS - 1)
    expect(getById).not.toHaveBeenCalled()
    await tick(1)
    expect(getById).toHaveBeenCalledTimes(1)
    expect(getById.mock.calls[0][0]).toBe('dep-1')
    expect(getById.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
    expect(useDeploymentStore.getState().currentDeployment?.latest_task).toEqual({ status: 'running' })
  })

  it('never touches isLoading or error', async () => {
    const seen: Array<[boolean, unknown]> = []
    const unsub = useDeploymentStore.subscribe((s) => seen.push([s.isLoading, s.error]))
    getById.mockImplementationOnce(() => reply(dep({ status: 'success' })))
    mount()
    await tick(STATUS_POLL_INTERVAL_MS)
    unsub()
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.every(([loading, error]) => loading === false && error === null)).toBe(true)
  })

  it.each(['success', 'failed', 'cancelled'])('stops after running -> %s', async (status) => {
    getById.mockImplementation(() => reply(dep({ status: status as any })))
    mount()
    await tick(STATUS_POLL_INTERVAL_MS)
    expect(useDeploymentStore.getState().currentDeployment?.status).toBe(status)
    await tick(60_000)
    expect(getById).toHaveBeenCalledTimes(1)
  })

  it('keeps the status on a network error, reports degraded and retries after 20 s', async () => {
    getById.mockImplementationOnce(() => Promise.reject(new Error('Network Error')))
    getById.mockImplementation(() => reply(dep({ status: 'running' })))
    const { result } = mount()
    await tick(STATUS_POLL_INTERVAL_MS)
    expect(result.current.pollingState).toBe('degraded')
    expect(useDeploymentStore.getState().currentDeployment?.status).toBe('running')
    await tick(STATUS_POLL_MAX_DELAY_MS - 1)
    expect(getById).toHaveBeenCalledTimes(1)
    await tick(1)
    expect(getById).toHaveBeenCalledTimes(2)
    expect(result.current.pollingState).toBe('polling')
  })

  it('treats 500 like a network error and caps the delay at 20 s', async () => {
    getById.mockImplementation(() => httpError(500))
    const { result } = mount()
    await tick(STATUS_POLL_INTERVAL_MS)
    await tick(STATUS_POLL_MAX_DELAY_MS)
    await tick(STATUS_POLL_MAX_DELAY_MS)
    expect(getById).toHaveBeenCalledTimes(3)
    await tick(STATUS_POLL_MAX_DELAY_MS)
    expect(getById).toHaveBeenCalledTimes(4)
    expect(result.current.pollingState).toBe('degraded')
  })

  it('stops on 403 without touching the store', async () => {
    getById.mockImplementation(() => httpError(403))
    const before = useDeploymentStore.getState().currentDeployment
    const { result } = mount()
    await tick(STATUS_POLL_INTERVAL_MS)
    expect(result.current.pollingState).toBe('forbidden')
    await tick(60_000)
    expect(getById).toHaveBeenCalledTimes(1)
    expect(useDeploymentStore.getState().currentDeployment).toBe(before)
  })

  it('stays stopped after 403 when the tab is hidden and shown again', async () => {
    getById.mockImplementation(() => httpError(403))
    const { result } = mount()
    await tick(STATUS_POLL_INTERVAL_MS)
    expect(result.current.pollingState).toBe('forbidden')
    setHidden(true)
    expect(result.current.pollingState).toBe('forbidden')
    setHidden(false)
    await tick(60_000)
    expect(getById).toHaveBeenCalledTimes(1)
    expect(result.current.pollingState).toBe('forbidden')
  })

  it('does not call onGone again after 404 when the tab is hidden and shown again', async () => {
    getById.mockImplementation(() => httpError(404))
    const { onGone } = mount()
    await tick(STATUS_POLL_INTERVAL_MS)
    setHidden(true)
    setHidden(false)
    await tick(60_000)
    expect(getById).toHaveBeenCalledTimes(1)
    expect(onGone).toHaveBeenCalledTimes(1)
  })

  it('calls onGone exactly once on 404 and stops', async () => {
    getById.mockImplementation(() => httpError(404))
    const { onGone } = mount()
    await tick(STATUS_POLL_INTERVAL_MS)
    await tick(60_000)
    expect(onGone).toHaveBeenCalledTimes(1)
    expect(getById).toHaveBeenCalledTimes(1)
  })

  it('never has two requests in flight and schedules the next one after the answer', async () => {
    let resolve!: (v: unknown) => void
    getById.mockImplementationOnce(() => new Promise((r) => { resolve = r }))
    getById.mockImplementation(() => reply(dep({ status: 'running' })))
    mount()
    await tick(STATUS_POLL_INTERVAL_MS + 60_000)
    expect(getById).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolve({ data: dep({ status: 'running' }) })
    })
    await tick(STATUS_POLL_INTERVAL_MS)
    expect(getById).toHaveBeenCalledTimes(2)
  })

  it('aborts on unmount, ignores the late answer and leaves no timer', async () => {
    let resolve!: (v: unknown) => void
    getById.mockImplementation(() => new Promise((r) => { resolve = r }))
    const { unmount } = mount()
    await tick(STATUS_POLL_INTERVAL_MS)
    const signal: AbortSignal = getById.mock.calls[0][1].signal
    const before = useDeploymentStore.getState().currentDeployment
    unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => {
      resolve({ data: dep({ status: 'success' }) })
    })
    expect(useDeploymentStore.getState().currentDeployment).toBe(before)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('drops a stale answer after the deploymentId changed, and a foreign deploymentId', async () => {
    let resolve!: (v: unknown) => void
    getById.mockImplementationOnce(() => new Promise((r) => { resolve = r }))
    getById.mockImplementation(() => reply(dep({ deploymentId: 'other', status: 'success' })))
    const { rerender } = mount()
    await tick(STATUS_POLL_INTERVAL_MS)
    const before = useDeploymentStore.getState().currentDeployment
    rerender({ deploymentId: 'dep-2', enabled: true })
    await act(async () => {
      resolve({ data: dep({ status: 'success' }) })
    })
    expect(useDeploymentStore.getState().currentDeployment).toBe(before)
    await tick(STATUS_POLL_INTERVAL_MS)
    expect(getById).toHaveBeenLastCalledWith('dep-2', expect.anything())
    expect(useDeploymentStore.getState().currentDeployment).toBe(before)
  })

  it('pauses while the tab is hidden and asks right away when it returns', async () => {
    getById.mockImplementation(() => reply(dep({ status: 'running' })))
    const { result } = mount()
    setHidden(true)
    expect(result.current.pollingState).toBe('paused')
    await tick(60_000)
    expect(getById).not.toHaveBeenCalled()
    setHidden(false)
    await tick(0)
    expect(getById).toHaveBeenCalledTimes(1)
    expect(result.current.pollingState).toBe('polling')
  })

  it('aborts an in-flight request when the tab is hidden and does not double up on return', async () => {
    getById.mockImplementation(() => new Promise(() => {}))
    mount()
    await tick(STATUS_POLL_INTERVAL_MS)
    const signal: AbortSignal = getById.mock.calls[0][1].signal
    setHidden(true)
    expect(signal.aborted).toBe(true)
    setHidden(false)
    await tick(0)
    expect(getById).toHaveBeenCalledTimes(2)
    setHidden(false)
    await tick(0)
    expect(getById).toHaveBeenCalledTimes(2)
  })

  it('does not write the store when the answer has not changed', async () => {
    const same = dep({ status: 'running' })
    useDeploymentStore.setState({ currentDeployment: same })
    getById.mockImplementation(() => reply(JSON.parse(JSON.stringify(same))))
    const writes = vi.fn()
    const unsub = useDeploymentStore.subscribe(writes)
    mount()
    await tick(STATUS_POLL_INTERVAL_MS)
    unsub()
    expect(getById).toHaveBeenCalledTimes(1)
    expect(writes).not.toHaveBeenCalled()
  })
})
