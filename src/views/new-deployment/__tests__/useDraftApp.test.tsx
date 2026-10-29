import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useAppStore } from '@/stores/app.store'
import { useDraftApp } from '../useDraftApp'

const app = (appId: string, name = `App ${appId}`) => ({ appId, name, image: null }) as never

let fetchAppById: ReturnType<typeof vi.fn>

/** A request the test settles by hand: the app is only known once it answers. */
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((res) => (resolve = res))
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  useDeploymentStore.getState().resetDraft()
  useDeploymentStore.getState().updateDraft({ appId: 'app-1' })
  fetchAppById = vi.fn().mockResolvedValue(undefined)
  useAppStore.setState({ apps: [], currentApp: null, fetchAppById } as never)
})

describe('useDraftApp', () => {
  it('finds the app in the list without asking the backend', () => {
    useAppStore.setState({ apps: [app('app-2'), app('app-1', 'pgAdmin')] })

    const { result } = renderHook(() => useDraftApp())

    expect(result.current).toMatchObject({ app: { name: 'pgAdmin' }, isLoading: false })
    expect(fetchAppById).not.toHaveBeenCalled()
  })

  it('takes the app the store has fetched on its own when it is the one of the draft', () => {
    useAppStore.setState({ currentApp: app('app-1', 'Web-LaTeX') as never })

    const { result } = renderHook(() => useDraftApp())

    expect(result.current).toMatchObject({ app: { name: 'Web-LaTeX' }, isLoading: false })
    expect(fetchAppById).not.toHaveBeenCalled()
  })

  it('asks for the app by id when the list does not hold it (the catalogue keeps its list to itself)', async () => {
    fetchAppById.mockImplementation(async () => useAppStore.setState({ currentApp: app('app-1', 'pgAdmin') as never }))

    const { result } = renderHook(() => useDraftApp())

    await waitFor(() => expect(result.current.app).toMatchObject({ name: 'pgAdmin' }))
    expect(fetchAppById).toHaveBeenCalledExactlyOnceWith('app-1')
    expect(result.current.isLoading).toBe(false)
  })

  it('is loading until the answer is there, and knows no app before that', async () => {
    const pending = deferred()
    fetchAppById.mockImplementation(async () => {
      await pending.promise
      useAppStore.setState({ currentApp: app('app-1', 'pgAdmin') as never })
    })

    const { result } = renderHook(() => useDraftApp())

    expect(result.current).toEqual({ app: null, isLoading: true })
    await act(async () => pending.resolve())
    await waitFor(() => expect(result.current).toMatchObject({ app: { name: 'pgAdmin' }, isLoading: false }))
  })

  it('does not take the fetched app of another draft', async () => {
    useAppStore.setState({ currentApp: app('app-9', 'Something else') as never })

    const { result } = renderHook(() => useDraftApp())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchAppById).toHaveBeenCalledWith('app-1')
    expect(result.current.app).toBeNull()
  })

  it('stops loading and knows no app when the backend does not have it, and does not ask again', async () => {
    const { result, rerender } = renderHook(() => useDraftApp())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    rerender()
    rerender()

    expect(result.current.app).toBeNull()
    expect(fetchAppById).toHaveBeenCalledTimes(1)
  })

  it('does not ask for an app when the draft has none', () => {
    useDeploymentStore.getState().updateDraft({ appId: null })

    const { result } = renderHook(() => useDraftApp())

    expect(result.current).toEqual({ app: null, isLoading: false })
    expect(fetchAppById).not.toHaveBeenCalled()
  })
})
