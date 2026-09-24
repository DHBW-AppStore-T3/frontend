import { defineStore } from 'pinia'
import { appApi } from '@/api/app.api'
import type { App, AppWithUser, AppCreate, AppUpdate } from '@/types'
import { runRequest } from './_request'

export const useAppStore = defineStore('app', {
  state: () => ({
    apps: [] as App[],
    currentApp: null as AppWithUser | null,
    isLoading: false,
    error: null as string | null,
  }),

  getters: {
    myApps: (state) => {
      const authStore = useAuthStore()
      return state.apps.filter((app) => app.userId === authStore.userId)
    },
  },

  actions: {
    async fetchApps(userId?: string) {
      await runRequest(this, async () => {
        const { data } = await appApi.list({ userId })
        this.apps = data
      }, 'Failed to fetch apps', { rethrow: false })
    },

    async fetchAppById(appId: string) {
      await runRequest(this, async () => {
        const { data } = await appApi.getById(appId)
        this.currentApp = data
      }, 'Failed to fetch app', { rethrow: false })
    },

    async createApp(data: AppCreate) {
      return runRequest(this, async () => {
        const { data: app } = await appApi.create(data)
        this.apps.push(app)
        return app
      }, 'Failed to create app')
    },

    async updateApp(appId: string, data: AppUpdate) {
      return runRequest(this, async () => {
        const { data: app } = await appApi.update(appId, data)
        const index = this.apps.findIndex((a) => a.appId === appId)
        if (index !== -1) {
          this.apps[index] = app
        }
        return app
      }, 'Failed to update app')
    },

    async deleteApp(appId: string) {
      await runRequest(this, async () => {
        await appApi.delete(appId)
        this.apps = this.apps.filter((a) => a.appId !== appId)
      }, 'Failed to delete app')
    },

    async fetchAppVariables(appId: string, version: string) {
      const { data } = await appApi.getVariables(appId, version)
      return data
    }
  },
})

import { useAuthStore } from './auth.store'