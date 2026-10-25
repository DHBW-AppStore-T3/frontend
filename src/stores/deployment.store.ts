import { create } from 'zustand'
import { deploymentApi } from '@/api/deployment.api'
import { useAppStore } from './app.store'
import { useAuthStore } from './auth.store'
import { runRequest } from './_request'
import { isMultiImagePackerLayout as isMultiImagePackerLayoutOf } from '@/utils/draft-variables'
import { networkPayload } from '@/utils/network'
import { isClusterRuntime } from '@/utils/runtime'

import type {
  App,
  User,
  Course,
  Deployment,
  DeploymentWithRelations,
  DeploymentCreate,
  DeploymentStatus,
  DeploymentDraft,
  AppVariable
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
  variableDefinitions: [] as AppVariable[], // stores the API definitions for the variables
  // ``fileUploads`` is the wizard-side staging area for files. Each
  // ``@openstack:file:<scope>``-marked variable contributes one entry
  // here, with inner-keys driven by the scope. ``submitDraft`` ships
  // the whole map under ``DeploymentCreate.files``.
  fileUploads: {},
  // How the version runs and, for VM apps, the credential (project) to
  // deploy with; set by the app detail page and the first wizard step.
  runtime: null,
  scope: null,
  credentialId: null,
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
       * Prepare and submit the current draft as a DeploymentCreate payload.
       * - Normalizes `releaseTag` which may come as string or object from UI
       * - Packs wizard selections (courses, groups, variables) into `userInputVar`
       * - Delegates creation to the API and returns the created deployment
       */
      if (!draft.appId || !draft.name) {
        throw new Error("App und Name sind Pflichtfelder")
      }

      const rawTag: any = draft.releaseTag
      let finalVersion = 'latest'

      if (rawTag && typeof rawTag === 'object') {
        finalVersion = rawTag.version || rawTag.name || 'latest'
      } else if (typeof rawTag === 'string' && rawTag.trim() !== '') {
        finalVersion = rawTag
      }

      // Teams: Array<{ name: string, userIds: string[] }>
      let teams: Array<{ name: string; userIds: string[] }> = []
      if (Array.isArray(draft.groupNames) && Array.isArray(draft.assignments)) {
        // assignments: Record<number, string[]>; groupNames: string[]
        teams = draft.groupNames.map((name: string, idx: number) => ({
          name,
          userIds: Array.isArray((draft.assignments as any)[idx]) ? (draft.assignments as any)[idx] : []
        }))
      }

      // Fallback: if no teams are defined, auto-create teams based on studentIds.
      if (teams.length === 0 && draft.studentIds.length > 0) {
        // Create teams based on groupCount.
        const groupCount = draft.groupCount
        const studentsPerGroup = Math.floor(draft.studentIds.length / groupCount)
        const remainder = draft.studentIds.length % groupCount
        
        teams = []
        let currentIndex = 0
        for (let i = 0; i < groupCount; i++) {
          const groupSize = studentsPerGroup + (i < remainder ? 1 : 0)
          const groupStudents = draft.studentIds.slice(currentIndex, currentIndex + groupSize)
          teams.push({
            name: draft.groupNames[i] || `Team-${i + 1}`,
            userIds: groupStudents
          })
          currentIndex += groupSize
        }
      }

      // Ensure all userIds are formatted as UUID strings.
      teams = teams.map(team => ({
        name: team.name,
        userIds: team.userIds.map(id => typeof id === 'string' ? id : String(id))
      }))

      // userInputVar: { packer: {...}, terraform: {...} }
      const userInputVarObj: any = { packer: {}, terraform: {} }
      if (draft.variables && typeof draft.variables === 'object') {
        // Multi-image Packer apps nest their values per template key.
        const draftVars = draft.variables as Record<string, any>
        const packerContainer = draftVars.packer
        const isMultiImagePackerLayout = isMultiImagePackerLayoutOf(draftVars)

        const resolveValue = (def: AppVariable): any => {
          if (def.source === 'packer' && isMultiImagePackerLayout) {
            const tkey = def.template_key ?? 'default'
            const fromNested = packerContainer?.[tkey]?.[def.name]
            if (fromNested !== undefined) return fromNested
          }
          return draftVars[def.name]
        }

        // variableDefinitions carries whether each var is packer/terraform.
        if (Array.isArray(draft.variableDefinitions)) {
          for (const def of draft.variableDefinitions) {
            // File-typed variables travel through ``files`` instead of
            // ``userInputVar``. Skipping them here keeps the variables
            // dict free of accidental ``undefined`` entries that would
            // confuse the backend's terraform encoder.
            if (def.osType === 'file') continue
            const val = resolveValue(def)
            // Skip empty / undefined values — they would otherwise be
            // forwarded to Terraform as ``-var=name=null`` and bypass
            // the variable's HCL ``default = ...``. Critical for any
            // variable whose default is structurally non-trivial
            // (e.g. ``map(object(...))``) — the user not touching it
            // must mean "use the default", not "set to null". An
            // empty string is also treated as "no input".
            if (val === undefined || val === null) continue
            if (typeof val === 'string' && val.trim() === '') continue
            // Scoped variables (``varScope = team|user``) arrive as a
            // map. An empty map means no slot was filled — same logic
            // applies: ship nothing so the HCL default wins.
            if (
              typeof val === 'object'
              && !Array.isArray(val)
              && (def.varScope === 'team' || def.varScope === 'user')
              && Object.keys(val).length === 0
            ) {
              continue
            }
            if (def.source === 'packer') {
              // Multi-image: nest under the template key so the worker
              // finds it at ``user_vars["packer"][template_key][name]``
              // (siehe worker/app/tasks.py). Single-image/legacy stays
              // flat at ``user_vars["packer"][name]``.
              if (isMultiImagePackerLayout) {
                const tkey = def.template_key ?? 'default'
                ;(userInputVarObj.packer[tkey] ??= {})[def.name] = val
              } else {
                userInputVarObj.packer[def.name] = val
              }
            }
            else if (def.source === 'terraform') userInputVarObj.terraform[def.name] = val
          }
        } else {
          // Fallback: alles in terraform
          userInputVarObj.terraform = { ...draft.variables }
        }
      }

      // Drop empty file-variable entries — the wizard may have rendered
      // a slot that the user never filled (optional file with default
      // ``{}``). Sending it would still hit the backend's ``file_var_empty``
      // guard with a confusing error.
      const fileUploads: Record<string, Record<string, any>> = {}
      if (draft.fileUploads) {
        for (const [varName, slotMap] of Object.entries(draft.fileUploads)) {
          const filledSlots: Record<string, any> = {}
          for (const [slotKey, file] of Object.entries(slotMap || {})) {
            if (file && file.content_b64) {
              filledSlots[slotKey] = file
            }
          }
          if (Object.keys(filledSlots).length > 0) {
            fileUploads[varName] = filledSlots
          }
        }
      }

      // cpu/memory the person chose for the containers the app lets them size.
      if (draft.resources && Object.keys(draft.resources).length > 0) {
        userInputVarObj.resources = draft.resources
      }
      // Internet / networked pods: only what the app allows, and pod networking
      // only with two or more workloads (otherwise there is nobody to reach).
      const network = networkPayload(draft)
      if (network) userInputVarObj.network = network
      const payload: any = {
        name: draft.name,
        appId: draft.appId,
        releaseTag: finalVersion,
        userInputVar: userInputVarObj,
        teams
      }
      // VM apps run in the project of the chosen credential; pods need none
      // (the API ignores one sent for a pod app).
      if (!isClusterRuntime(draft.runtime) && draft.credentialId) {
        payload.credentialId = draft.credentialId
      }
      if (Object.keys(fileUploads).length > 0) {
        payload.files = fileUploads
      }

      const response = await get().createDeployment(payload as DeploymentCreate)
      return response
    }
}))
