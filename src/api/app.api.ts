import api from './axios'
import type {
  App,
  AppWithUser,
  AppCreate,
  AppUpdate,
  AppQueryParams,
  AppRuntime,
  AppVariable,
  AppVersionApproval,
  AppVersionApprovalWithApp,
} from '@/types'

// ----------------------------------------------------------------
// APP API
// ----------------------------------------------------------------
export const appApi = {
  list: (params?: AppQueryParams) => {
    return api.get<App[]>('/apps/', { params })
  },

  getById: (appId: string, refresh: boolean = false) => {
    return api.get<AppWithUser>(`/apps/${appId}`, {
      params: { refresh }
    })
  },

  create: (data: AppCreate) => {
    return api.post<App>('/apps/', data)
  },

  update: (appId: string, data: AppUpdate) => {
    return api.put<App>(`/apps/${appId}`, data)
  },

  delete: (appId: string) => {
    return api.delete(`/apps/${appId}`)
  },

  getVariables: (appId: string, version: string) => {
    return api.get<AppVariable[]>(`/apps/${appId}/variables`, {
      params: { version }
    })
  },

  /**
   * How ``version`` runs: runtime and group mode (``scope``).
   * 422 with field paths for an invalid or missing appstore.yaml.
   */
  getRuntime: (appId: string, version: string) => {
    return api.get<AppRuntime>(`/apps/${appId}/runtime`, {
      params: { version }
    })
  },

  // ----------------------------------------------------------------
  // VERSION APPROVALS (Owner-Seite)
  // ----------------------------------------------------------------
  submitVersion: (appId: string, versionTag: string, diffUrl?: string, notes?: string) => {
    return api.post<AppVersionApproval>(
      `/apps/${appId}/versions/${encodeURIComponent(versionTag)}/submit`,
      { diff_url: diffUrl ?? null, notes: notes ?? null }
    )
  },

  withdrawVersion: (appId: string, versionTag: string) => {
    return api.delete(`/apps/${appId}/versions/${encodeURIComponent(versionTag)}/submit`)
  },

  listVersionApprovals: (appId: string) => {
    return api.get<AppVersionApproval[]>(`/apps/${appId}/versions`)
  },

  // ----------------------------------------------------------------
  // VERSION APPROVALS (Admin-Seite)
  // ----------------------------------------------------------------
  admin: {
    listPendingApprovals: () => {
      return api.get<AppVersionApprovalWithApp[]>('/admin/apps/versions/pending')
    },

    approveVersion: (appId: string, versionTag: string) => {
      return api.post<AppVersionApproval>(
        `/admin/apps/${appId}/versions/${encodeURIComponent(versionTag)}/approve`
      )
    },

    rejectVersion: (appId: string, versionTag: string, rejectionReason: string) => {
      return api.post<AppVersionApproval>(
        `/admin/apps/${appId}/versions/${encodeURIComponent(versionTag)}/reject`,
        { rejection_reason: rejectionReason }
      )
    },

    setRecommended: (appId: string, recommended: boolean) => {
      return api.put<App>(`/admin/apps/${appId}/recommended`, { recommended })
    },

    setDeployVersion: (appId: string, versionTag: string) => {
      return api.put<App>(`/admin/apps/${appId}/deploy-version`, { version_tag: versionTag })
    },

    revokeVersion: (appId: string, versionTag: string, rejectionReason: string) => {
      return api.post<AppVersionApproval>(
        `/admin/apps/${appId}/versions/${encodeURIComponent(versionTag)}/revoke`,
        { rejection_reason: rejectionReason }
      )
    },
  },
}