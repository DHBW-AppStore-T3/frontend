import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppStore } from '../app.store'

vi.mock('@/api/app.api', () => ({
  appApi: {
    list: vi.fn(() => Promise.resolve({ data: [] })),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getVariables: vi.fn(),
  },
}))

vi.mock('../auth.store', () => ({
  useAuthStore: () => ({ userId: 'test-user-id' }),
}))

import { appApi } from '@/api/app.api'
const mockApi = appApi as Record<string, ReturnType<typeof vi.fn>>

const APP1 = { appId: 'app-1', name: 'App Alpha', userId: 'test-user-id' }
const APP2 = { appId: 'app-2', name: 'App Beta',  userId: 'other-user' }

describe('AppStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('initializes with empty state', () => {
    const store = useAppStore()
    expect(store.apps).toEqual([])
    expect(store.currentApp).toBeNull()
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('fetchApps sets apps from API', async () => {
    mockApi.list.mockResolvedValueOnce({ data: [APP1, APP2] })
    const store = useAppStore()
    await store.fetchApps()
    expect(store.apps).toEqual([APP1, APP2])
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('fetchApps passes optional userId param', async () => {
    mockApi.list.mockResolvedValueOnce({ data: [] })
    const store = useAppStore()
    await store.fetchApps('user-42')
    expect(mockApi.list).toHaveBeenCalledWith({ userId: 'user-42' })
  })

  it('fetchApps handles errors without rethrowing', async () => {
    mockApi.list.mockRejectedValueOnce({ response: { data: { detail: 'Server error' } } })
    const store = useAppStore()
    await expect(store.fetchApps()).resolves.toBeUndefined()
    expect(store.error).toBe('Server error')
    expect(store.isLoading).toBe(false)
  })

  it('fetchAppById sets currentApp on success', async () => {
    mockApi.getById.mockResolvedValueOnce({ data: APP1 })
    const store = useAppStore()
    await store.fetchAppById('app-1')
    expect(store.currentApp).toEqual(APP1)
    expect(store.isLoading).toBe(false)
  })

  it('fetchAppById handles errors without rethrowing', async () => {
    mockApi.getById.mockRejectedValueOnce(new Error('404'))
    const store = useAppStore()
    await expect(store.fetchAppById('app-1')).resolves.toBeUndefined()
    expect(store.error).toBeTruthy()
  })

  it('createApp pushes new app and returns it', async () => {
    mockApi.create.mockResolvedValueOnce({ data: APP1 })
    const store = useAppStore()
    const result = await store.createApp({ name: 'App Alpha' } as any)
    expect(result).toEqual(APP1)
    expect(store.apps).toContainEqual(APP1)
  })

  it('updateApp replaces the matching app in-place', async () => {
    mockApi.update.mockResolvedValueOnce({ data: { ...APP1, name: 'App Alpha v2' } })
    const store = useAppStore()
    store.apps = [APP1 as any, APP2 as any]
    const result = await store.updateApp('app-1', { name: 'App Alpha v2' } as any)
    expect(result).toMatchObject({ appId: 'app-1', name: 'App Alpha v2' })
    expect(store.apps[0].name).toBe('App Alpha v2')
    expect(store.apps).toHaveLength(2)
  })

  it('updateApp is a no-op when appId not in list', async () => {
    mockApi.update.mockResolvedValueOnce({ data: APP1 })
    const store = useAppStore()
    store.apps = [APP2 as any]
    await store.updateApp('app-1', {} as any)
    expect(store.apps).toHaveLength(1)
    expect(store.apps[0]).toEqual(APP2)
  })

  it('deleteApp removes app from list', async () => {
    mockApi.delete.mockResolvedValueOnce({})
    const store = useAppStore()
    store.apps = [APP1 as any, APP2 as any]
    await store.deleteApp('app-1')
    expect(store.apps).toEqual([APP2])
  })

  it('fetchAppVariables returns variable array directly', async () => {
    const vars = [{ name: 'region', type: 'string' }]
    mockApi.getVariables.mockResolvedValueOnce({ data: vars })
    const store = useAppStore()
    const result = await store.fetchAppVariables('app-1', 'v1.0')
    expect(result).toEqual(vars)
    expect(mockApi.getVariables).toHaveBeenCalledWith('app-1', 'v1.0')
  })

  it('myApps getter filters apps by current userId', () => {
    const store = useAppStore()
    store.apps = [APP1 as any, APP2 as any]
    expect(store.myApps).toEqual([APP1])
  })
})
