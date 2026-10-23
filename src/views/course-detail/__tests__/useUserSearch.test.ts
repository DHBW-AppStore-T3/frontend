import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/api/user.api', () => ({ userApi: { list: vi.fn(), search: vi.fn() } }))

import { userApi } from '@/api/user.api'
import { useUserSearch } from '../useUserSearch'

const users = (...names: string[]) => ({ data: names.map((n) => ({ userId: n, username: n })) }) as any

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(userApi.list).mockReset().mockResolvedValue(users('first'))
  vi.mocked(userApi.search).mockReset().mockResolvedValue(users('found'))
})
afterEach(() => vi.useRealTimers())

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0) })

describe('useUserSearch', () => {
  it('stays idle while the picker is closed', async () => {
    renderHook(() => useUserSearch(false, 0))
    await flush()
    expect(userApi.list).not.toHaveBeenCalled()
  })

  it('loads the default student list for an empty query', async () => {
    const { result } = renderHook(() => useUserSearch(true, 1))
    expect(result.current.isSearching).toBe(true)
    await flush()
    expect(userApi.list).toHaveBeenCalledWith({ role: 'student', limit: 100 })
    expect(result.current.users.map((u) => u.userId)).toEqual(['first'])
    expect(result.current.isSearching).toBe(false)
  })

  it('debounces searches by 300ms and ignores one-character queries', async () => {
    const { result } = renderHook(() => useUserSearch(true, 1))
    await flush()

    act(() => result.current.setQuery('S'))
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(userApi.search).not.toHaveBeenCalled()

    act(() => result.current.setQuery('Sea'))
    await act(async () => { await vi.advanceTimersByTimeAsync(299) })
    expect(userApi.search).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })

    expect(userApi.search).toHaveBeenCalledWith('Sea', 10)
    expect(result.current.users.map((u) => u.userId)).toEqual(['found'])
  })

  it('only issues the latest query when typing quickly', async () => {
    const { result } = renderHook(() => useUserSearch(true, 1))
    await flush()

    act(() => result.current.setQuery('ab'))
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    act(() => result.current.setQuery('abc'))
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })

    expect(userApi.search).toHaveBeenCalledTimes(1)
    expect(userApi.search).toHaveBeenCalledWith('abc', 10)
  })

  it('reloads the default list when the picker is opened again', async () => {
    const { rerender } = renderHook(({ session }) => useUserSearch(true, session), {
      initialProps: { session: 1 },
    })
    await flush()
    rerender({ session: 2 })
    await flush()
    expect(userApi.list).toHaveBeenCalledTimes(2)
  })

  it('reports a failed default list through onError and shows no users', async () => {
    vi.mocked(userApi.list).mockRejectedValue(new Error('down'))
    const onError = vi.fn()
    const { result } = renderHook(() => useUserSearch(true, 1, onError))
    await flush()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(result.current.users).toEqual([])
  })

  it('falls back to no results when the search fails', async () => {
    vi.mocked(userApi.search).mockRejectedValue(new Error('down'))
    const { result } = renderHook(() => useUserSearch(true, 1))
    await flush()
    act(() => result.current.setQuery('zz'))
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    expect(result.current.users).toEqual([])
  })
})
