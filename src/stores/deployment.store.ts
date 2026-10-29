import { create } from 'zustand'
import { deploymentApi } from '@/api/deployment.api'
import { useAppStore } from './app.store'
import { useAuthStore } from './auth.store'
import { runRequest } from './_request'
import { buildDeploymentPayload, DRAFT_REQUIRED_ERROR } from '@/utils/deployment-payload'

import type {
  App,
  User,
  Course,
  Deployment,
  DeploymentWithRelations,
  DeploymentCreate,
  DeploymentStatus,
  DeploymentDraft
} from '@/types'

const defaultDraft: DeploymentDraft = {
  appId: null,
  name: '',
  releaseTag: '',
  courseIds: [],
  studentIds: [],
  groupMode: 'one',
  groupCount: 1,
  assignments: [],

  // --- These must match the interface ---
  version: 'latest',
  variables: {},
  userInputVar: {},
  groupNames: [],
  // ``variableDefinitions`` (the API definitions of the app's variables) is left out on purpose:
  // ``undefined`` means "not loaded yet", ``[]`` "loaded, and the app has none".
  // ``fileUploads`` is the wizard-side staging area for files. Each
  // ``file`` variable contributes one entry
  // here, with inner-keys driven by the scope. ``submitDraft`` ships
  // the whole map under ``DeploymentCreate.files``.
  fileUploads: {},
  // How the version runs; set by the app detail page and the first wizard step.
  runtime: null,
  scope: null,
}

type DeploymentListParams = { userId?: string; appId?: string; status?: DeploymentStatus }
type ApiResponse<K extends keyof typeof deploymentApi> = Awaited<ReturnType<(typeof deploymentApi)[K]>>

interface DeploymentState {
  deployments: Deployment[]

  currentDeployment: DeploymentWithRelations | null
  isLoading: boolean
  error: string | null

  // The wizard state (draft).
  draft: DeploymentDraft

  // Global cache for students and courses (userId/courseId → object).
  // These were `Map<string, any>` because the hand-written `User` type
  // was missing keycloak_id / firstName / lastName, which the backend
  // does return. `User` is derived from the OpenAPI schema now, so the
  // cache can say what it actually holds.
  studentCache: Map<string, User>
  courseCache: Map<string, Course>

  /** Deployments owned by the authenticated user (reads the auth store at call time). */
  myDeployments: () => Deployment[]
  deploymentsByStatus: (status: DeploymentStatus) => Deployment[]
  /** The app selected in the wizard, resolved from the app store. */
  draftAppDetails: () => App | null

  fetchDeployments: (params?: DeploymentListParams) => Promise<void>
  fetchDeploymentById: (id: string) => Promise<void>
  createDeployment: (data: DeploymentCreate) => Promise<Deployment>
  deleteDeployment: (id: string) => Promise<ApiResponse<'delete'>>
  cancelDeployment: (id: string) => Promise<ApiResponse<'cancel'>>
  pauseDeployment: (id: string) => Promise<ApiResponse<'pause'>>
  resumeDeployment: (id: string) => Promise<ApiResponse<'resume'>>

  /** Merge a partial update into the wizard draft (replaces in-place mutation). */
  updateDraft: (patch: Partial<DeploymentDraft>) => void
  resetDraft: () => void
  submitDraft: () => Promise<Deployment>
}

export const useDeploymentStore = create<DeploymentState>()((set, get) => ({
  deployments: [],
  currentDeployment: null,
  isLoading: false,
  error: null,
  draft: JSON.parse(JSON.stringify(defaultDraft)) as DeploymentDraft,
  studentCache: new Map<string, User>(),
  courseCache: new Map<string, Course>(),

  myDeployments() {
    const userId = useAuthStore.getState().user?.userId
    return get().deployments.filter((d) => d.userId === userId)
  },

  deploymentsByStatus(status) {
    return get().deployments.filter((d) => d.status === status)
  },

  draftAppDetails() {
    const { draft } = get()
    if (!draft.appId) return null
    return useAppStore.getState().apps.find((a) => a.appId === draft.appId) || null
  },

    async fetchDeployments(params) {
      await runRequest(set, async () => {
        const response = await deploymentApi.list(params)
        set({ deployments: response.data })
      }, 'Failed to fetch deployments', { rethrow: false })
    },

    async fetchDeploymentById(id) {
      await runRequest(set, async () => {
        try {
          const response = await deploymentApi.getById(id)
          set({ currentDeployment: response.data })
        } catch (err) {
          // 404 = deployment was soft-deleted upstream (e.g. after a successful
          // destroy). This is not a UI error state: the DetailView's stream-ended
          // watcher checks ``currentDeployment === null`` as a soft-delete signal
          // and navigates to the list with a success toast. Swallowed here so
          // runRequest never sees it; other status codes (5xx, network timeout)
          // are re-thrown and take the normal error path.
          if ((err as { response?: { status?: number } })?.response?.status === 404) {
            set({ currentDeployment: null })
            return
          }
          throw err
        }
      }, 'Failed to fetch deployment', { rethrow: false })
    },

    async createDeployment(data) {
      return runRequest(set, async () => {
        const response = await deploymentApi.create(data)
        set((s) => ({ deployments: [...s.deployments, response.data] }))
        return response.data
      }, 'Failed to create deployment')
    },

    /**
     * Delete a deployment. Returns the raw HTTP response so the caller
     * can branch on status (202 = destroy task dispatched, watch the
     * SSE stream; 204 = soft-deleted immediately).
     *
     * Drops the row from the local list either way — the deployment
     * either disappears now (204) or shortly when the destroy task
     * completes and auto-soft-deletes it (202). Keeping it in the
     * sidebar list while it's running would only confuse the user;
     * the live progress lives in the detail view that issued the call.
     */
    async deleteDeployment(id) {
      return runRequest(set, async () => {
        const response = await deploymentApi.delete(id)
        set((s) => ({ deployments: s.deployments.filter((d) => d.deploymentId !== id) }))
        return response
      }, 'Failed to delete deployment')
    },

    /**
     * Pause a running deployment. Returns the raw HTTP response (202
     * with ``{task_id, status: "pausing"}``) so the detail view can
     * attach the SSE stream and switch into the live-progress UI.
     *
     * Unlike ``deleteDeployment``, the deployment row stays in the
     * list — pausing isn't a destruction, the user expects to find
     * it again under the new "paused" status. Status refresh comes
     * via the next list fetch or the SSE ``succeeded`` event.
     */
    /**
     * Cancel an in-flight deployment. Returns the 202
     * ``{task_id, status: "destroying"}`` response so the detail view
     * can attach the live stream and watch the cleanup run.
     */
    async cancelDeployment(id) {
      return runRequest(set, () => deploymentApi.cancel(id), 'Failed to cancel deployment')
    },

    async pauseDeployment(id) {
      return runRequest(set, () => deploymentApi.pause(id), 'Failed to pause deployment')
    },

    /**
     * Resume a paused deployment. Mirrors ``pauseDeployment`` —
     * returns the 202 ``{task_id, status: "resuming"}`` response so
     * the detail view can attach the live stream.
     */
    async resumeDeployment(id) {
      return runRequest(set, () => deploymentApi.resume(id), 'Failed to resume deployment')
    },

    updateDraft(patch) {
      set((s) => ({ draft: { ...s.draft, ...patch } }))
    },

    resetDraft() {
      set({ draft: JSON.parse(JSON.stringify(defaultDraft)) })
    },

    async submitDraft() {
      const draft = get().draft
      /**
       * Build the DeploymentCreate payload from the current draft
       * (``buildDeploymentPayload``) and submit it through ``createDeployment``.
       */
      if (!draft.appId || !draft.name) {
        throw new Error(DRAFT_REQUIRED_ERROR)
      }

      const response = await get().createDeployment(buildDeploymentPayload(draft))
      return response
    }
}))
