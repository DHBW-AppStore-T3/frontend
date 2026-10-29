import { create } from 'zustand'
import { appApi } from '@/api/app.api'
import type { App, AppWithUser, AppCreate, AppUpdate } from '@/types'
import { runRequest } from './_request'
import { useAuthStore } from './auth.store'

type AppVariables = Awaited<ReturnType<typeof appApi.getVariables>>['data']

interface AppState {
  apps: App[]
  currentApp: AppWithUser | null
  isLoading: boolean
  error: string | null

  /** Apps owned by the authenticated user (reads the auth store at call time). */
  myApps: () => App[]
  fetchApps: (userId?: string) => Promise<void>
  fetchAppById: (appId: string) => Promise<void>
  createApp: (data: AppCreate) => Promise<App>
  updateApp: (appId: string, data: AppUpdate) => Promise<App>
  deleteApp: (appId: string) => Promise<void>
  fetchAppVariables: (appId: string, version: string) => Promise<AppVariables>
}

export const useAppStore = create<AppState>()((set, get) => ({
  apps: [],
  currentApp: null,
  isLoading: false,
  error: null,

  myApps() {
    const userId = useAuthStore.getState().user?.userId
    return get().apps.filter((app) => app.userId === userId)
  },

  async fetchApps(userId) {
    await runRequest(set, async () => {
      const { data } = await appApi.list({ userId })
      set({ apps: data })
    }, 'Failed to fetch apps', { rethrow: false })
  },

  async fetchAppById(appId) {
    await runRequest(set, async () => {
      const { data } = await appApi.getById(appId)
      set({ currentApp: data })
    }, 'Failed to fetch app', { rethrow: false })
  },

  async createApp(data) {
    return runRequest(set, async () => {
      const { data: app } = await appApi.create(data)
      set((s) => ({ apps: [...s.apps, app] }))
      return app
    }, 'Failed to create app')
  },

  async updateApp(appId, data) {
    return runRequest(set, async () => {
      const { data: app } = await appApi.update(appId, data)
      set((s) => ({ apps: s.apps.map((a) => (a.appId === appId ? app : a)) }))
      return app
    }, 'Failed to update app')
  },

  async deleteApp(appId) {
    await runRequest(set, async () => {
      await appApi.delete(appId)
      set((s) => ({ apps: s.apps.filter((a) => a.appId !== appId) }))
    }, 'Failed to delete app')
  },

  async fetchAppVariables(appId, version) {
    const { data } = await appApi.getVariables(appId, version)
    return data
  },
}))
