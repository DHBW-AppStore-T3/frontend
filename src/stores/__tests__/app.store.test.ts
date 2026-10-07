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

describe('AppStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with empty state', () => {
    const store = useAppStore()
    expect(store.apps).toEqual([])
    expect(store.currentApp).toBeNull()
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('fetchApps sets apps from API', async () => {
    const { appApi } = await import('@/api/app.api')
    const mockApps = [{ appId: '1', name: 'Test App', userId: 'test-user-id' }]
    vi.mocked(appApi.list).mockResolvedValueOnce({ data: mockApps } as any)

    const store = useAppStore()
    await store.fetchApps()

    expect(store.apps).toEqual(mockApps)
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('fetchApps handles errors', async () => {
    const { appApi } = await import('@/api/app.api')
    vi.mocked(appApi.list).mockRejectedValueOnce({
      response: { data: { detail: 'Server error' } },
    })

    const store = useAppStore()
    await store.fetchApps()

    expect(store.apps).toEqual([])
    expect(store.error).toBe('Server error')
    expect(store.isLoading).toBe(false)
  })

  describe('fetchAppById', () => {
    it('sets currentApp from the API', async () => {
      const { appApi } = await import('@/api/app.api')
      const app = { appId: 'a-1', name: 'Test App' }
      vi.mocked(appApi.getById).mockResolvedValueOnce({ data: app } as any)

      const store = useAppStore()
      await store.fetchAppById('a-1')

      expect(store.currentApp).toEqual(app)
    })

    it('swallows errors', async () => {
      const { appApi } = await import('@/api/app.api')
      vi.mocked(appApi.getById).mockRejectedValueOnce(new Error('not found'))

      const store = useAppStore()
      await expect(store.fetchAppById('a-1')).resolves.toBeUndefined()
      expect(store.error).toBe('not found')
    })
  })

  describe('createApp', () => {
    it('appends the created app and returns it', async () => {
      const { appApi } = await import('@/api/app.api')
      const app = { appId: 'a-2', name: 'New App' }
      vi.mocked(appApi.create).mockResolvedValueOnce({ data: app } as any)

      const store = useAppStore()
      const result = await store.createApp({ name: 'New App' } as any)

      expect(result).toEqual(app)
      expect(store.apps).toContainEqual(app)
    })

    it('re-throws on failure', async () => {
      const { appApi } = await import('@/api/app.api')
      vi.mocked(appApi.create).mockRejectedValueOnce(new Error('invalid'))

      const store = useAppStore()
      await expect(store.createApp({} as any)).rejects.toThrow('invalid')
      expect(store.error).toBe('invalid')
    })
  })

  describe('updateApp', () => {
    it('replaces the app in the list', async () => {
      const { appApi } = await import('@/api/app.api')
      const updated = { appId: 'a-1', name: 'Renamed' }
      vi.mocked(appApi.update).mockResolvedValueOnce({ data: updated } as any)

      const store = useAppStore()
      store.apps = [{ appId: 'a-1', name: 'Old' }] as any

      await store.updateApp('a-1', { name: 'Renamed' } as any)

      expect(store.apps[0]).toEqual(updated)
    })

    it('leaves the list untouched when the app id is not found', async () => {
      const { appApi } = await import('@/api/app.api')
      vi.mocked(appApi.update).mockResolvedValueOnce({ data: { appId: 'a-2' } } as any)

      const store = useAppStore()
      store.apps = [{ appId: 'a-1', name: 'Old' }] as any

      await store.updateApp('a-2', {} as any)

      expect(store.apps).toEqual([{ appId: 'a-1', name: 'Old' }])
    })
  })

  describe('deleteApp', () => {
    it('removes the app from the list', async () => {
      const { appApi } = await import('@/api/app.api')
      vi.mocked(appApi.delete).mockResolvedValueOnce({} as any)

      const store = useAppStore()
      store.apps = [{ appId: 'a-1' }, { appId: 'a-2' }] as any

      await store.deleteApp('a-1')

      expect(store.apps).toEqual([{ appId: 'a-2' }])
    })
  })

  describe('fetchAppVariables', () => {
    it('returns the variables from the API without touching store state', async () => {
      const { appApi } = await import('@/api/app.api')
      const variables = [{ name: 'flavor', source: 'terraform' }]
      vi.mocked(appApi.getVariables).mockResolvedValueOnce({ data: variables } as any)

      const store = useAppStore()
      const result = await store.fetchAppVariables('a-1', '1.0.0')

      expect(result).toEqual(variables)
      expect(appApi.getVariables).toHaveBeenCalledWith('a-1', '1.0.0')
    })

    it('propagates errors directly (no runRequest wrapping)', async () => {
      const { appApi } = await import('@/api/app.api')
      vi.mocked(appApi.getVariables).mockRejectedValueOnce(new Error('no such version'))

      const store = useAppStore()
      await expect(store.fetchAppVariables('a-1', 'bogus')).rejects.toThrow('no such version')
      expect(store.error).toBeNull()
    })
  })

  describe('myApps', () => {
    it('filters apps by the authenticated user id', () => {
      const store = useAppStore()
      store.apps = [
        { appId: 'a-1', userId: 'test-user-id' },
        { appId: 'a-2', userId: 'someone-else' },
      ] as any

      expect(store.myApps).toEqual([{ appId: 'a-1', userId: 'test-user-id' }])
    })
  })
})
