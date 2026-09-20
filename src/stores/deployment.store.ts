import { defineStore } from 'pinia'
import { deploymentApi } from '@/api/deployment.api'
import { useAppStore } from './app.store'
import { useAuthStore } from './auth.store'

import type {
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
  fileUploads: {}
}

export const useDeploymentStore = defineStore('deployment', {
  state: () => ({
    deployments: [] as Deployment[],

    currentDeployment: null as DeploymentWithRelations | null,
    isLoading: false,
    error: null as string | null,

    // The wizard state (draft).
    draft: JSON.parse(JSON.stringify(defaultDraft)) as DeploymentDraft,

    // Global cache for students and courses (userId/courseId → object).
    studentCache: new Map<string, any>(),
    courseCache: new Map<string, any>(),
  }),

  getters: {
    myDeployments: (state) => {
      const authStore = useAuthStore()
      return state.deployments.filter((d) => d.userId === authStore.userId)
    },

    deploymentsByStatus: (state) => {
      return (status: DeploymentStatus) =>
        state.deployments.filter((d) => d.status === status)
    },

    draftAppDetails: (state) => {
      const appStore = useAppStore()
      if (!state.draft.appId) return null
      return appStore.apps.find(a => a.appId === state.draft.appId) || null
    }
  },
  actions: {
    async fetchDeployments(params?: { userId?: string; appId?: string; status?: DeploymentStatus }) {
      this.isLoading = true; this.error = null
      try {
        const response = await deploymentApi.list(params)
        this.deployments = response.data
      } catch (err: any) {
        this.error = err.response?.data?.detail || 'Failed to fetch deployments'
      } finally {
        this.isLoading = false
      }
    },

    async fetchDeploymentById(id: string) {
      this.isLoading = true; this.error = null
      try {
        const response = await deploymentApi.getById(id)
        this.currentDeployment = response.data
      } catch (err: any) {
        // 404 = deployment was soft-deleted upstream (e.g. after a successful
        // destroy). This is not a UI error state: the DetailView's stream-ended
        // watcher checks ``currentDeployment === null`` as a soft-delete signal
        // and navigates to the list with a success toast. Other status codes
        // (5xx, network timeout) keep the error path intact.
        const status = err?.response?.status
        if (status === 404) {
          this.currentDeployment = null
        } else {
          this.error = err.response?.data?.detail || 'Failed to fetch deployment'
        }
      } finally {
        this.isLoading = false
      }
    },

    async createDeployment(data: DeploymentCreate) {
      this.isLoading = true; this.error = null
      try {
        const response = await deploymentApi.create(data)
        this.deployments.push(response.data)
        return response.data
      } catch (err: any) {
        this.error = err.response?.data?.detail || 'Failed to create deployment'
        throw err
      } finally {
        this.isLoading = false
      }
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
    async deleteDeployment(id: string) {
      this.isLoading = true; this.error = null
      try {
        const response = await deploymentApi.delete(id)
        this.deployments = this.deployments.filter((d: any) => d.deploymentId !== id)
        return response
      } catch (err: any) {
        this.error = err.response?.data?.detail || 'Failed to delete deployment'
        throw err
      } finally {
        this.isLoading = false
      }
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
    async cancelDeployment(id: string) {
      this.isLoading = true; this.error = null
      try {
        return await deploymentApi.cancel(id)
      } catch (err: any) {
        this.error = err.response?.data?.detail || 'Failed to cancel deployment'
        throw err
      } finally {
        this.isLoading = false
      }
    },

    async pauseDeployment(id: string) {
      this.isLoading = true; this.error = null
      try {
        return await deploymentApi.pause(id)
      } catch (err: any) {
        this.error = err.response?.data?.detail || 'Failed to pause deployment'
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Resume a paused deployment. Mirrors ``pauseDeployment`` —
     * returns the 202 ``{task_id, status: "resuming"}`` response so
     * the detail view can attach the live stream.
     */
    async resumeDeployment(id: string) {
      this.isLoading = true; this.error = null
      try {
        return await deploymentApi.resume(id)
      } catch (err: any) {
        this.error = err.response?.data?.detail || 'Failed to resume deployment'
        throw err
      } finally {
        this.isLoading = false
      }
    },

    resetDraft() {
      this.draft = JSON.parse(JSON.stringify(defaultDraft))
    },

    async submitDraft() {
      /**
       * Prepare and submit the current draft as a DeploymentCreate payload.
       * - Normalizes `releaseTag` which may come as string or object from UI
       * - Packs wizard selections (courses, groups, variables) into `userInputVar`
       * - Delegates creation to the API and returns the created deployment
       */
      if (!this.draft.appId || !this.draft.name) {
        throw new Error("App und Name sind Pflichtfelder")
      }

      const rawTag: any = this.draft.releaseTag
      let finalVersion = 'latest'

      if (rawTag && typeof rawTag === 'object') {
        finalVersion = rawTag.version || rawTag.name || 'latest'
      } else if (typeof rawTag === 'string' && rawTag.trim() !== '') {
        finalVersion = rawTag
      }

      // Teams: Array<{ name: string, userIds: string[] }>
      let teams: Array<{ name: string; userIds: string[] }> = []
      if (Array.isArray(this.draft.groupNames) && Array.isArray(this.draft.assignments)) {
        // assignments: Record<number, string[]>; groupNames: string[]
        teams = this.draft.groupNames.map((name: string, idx: number) => ({
          name,
          userIds: Array.isArray((this.draft.assignments as any)[idx]) ? (this.draft.assignments as any)[idx] : []
        }))
      }

      // Fallback: if no teams are defined, auto-create teams based on studentIds.
      if (teams.length === 0 && this.draft.studentIds.length > 0) {
        // Create teams based on groupCount.
        const groupCount = this.draft.groupCount
        const studentsPerGroup = Math.floor(this.draft.studentIds.length / groupCount)
        const remainder = this.draft.studentIds.length % groupCount
        
        teams = []
        let currentIndex = 0
        for (let i = 0; i < groupCount; i++) {
          const groupSize = studentsPerGroup + (i < remainder ? 1 : 0)
          const groupStudents = this.draft.studentIds.slice(currentIndex, currentIndex + groupSize)
          teams.push({
            name: this.draft.groupNames[i] || `Team-${i + 1}`,
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
      let userInputVarObj: any = { packer: {}, terraform: {} }
      if (this.draft.variables && typeof this.draft.variables === 'object') {
        // Detect multi-image Packer layout: such apps store Packer values nested
        // under ``draft.variables.packer[<template_key>][<name>]`` rather than
        // flat under ``draft.variables[<name>]``. Reading only flat would leave
        // ``val`` undefined for those variables. Same detection/resolution as in
        // ``NewDeploymentSummaryView``.
        const draftVars = this.draft.variables as Record<string, any>
        const packerContainer = draftVars.packer
        const isMultiImagePackerLayout =
          packerContainer
          && typeof packerContainer === 'object'
          && !Array.isArray(packerContainer)
          && Object.keys(packerContainer).length > 0
          && Object.keys(packerContainer).every((k) => {
            const slot = packerContainer[k]
            return slot && typeof slot === 'object' && !Array.isArray(slot)
          })

        const resolveValue = (def: AppVariable): any => {
          if (def.source === 'packer' && isMultiImagePackerLayout) {
            const tkey = def.template_key ?? 'default'
            const fromNested = packerContainer?.[tkey]?.[def.name]
            if (fromNested !== undefined) return fromNested
          }
          return draftVars[def.name]
        }

        // variableDefinitions carries whether each var is packer/terraform.
        if (Array.isArray(this.draft.variableDefinitions)) {
          for (const def of this.draft.variableDefinitions) {
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
          userInputVarObj.terraform = { ...this.draft.variables }
        }
      }

      // Drop empty file-variable entries — the wizard may have rendered
      // a slot that the user never filled (optional file with default
      // ``{}``). Sending it would still hit the backend's ``file_var_empty``
      // guard with a confusing error.
      const fileUploads: Record<string, Record<string, any>> = {}
      if (this.draft.fileUploads) {
        for (const [varName, slotMap] of Object.entries(this.draft.fileUploads)) {
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

      const payload: any = {
        name: this.draft.name,
        appId: this.draft.appId,
        releaseTag: finalVersion,
        userInputVar: userInputVarObj,
        teams
      }
      if (Object.keys(fileUploads).length > 0) {
        payload.files = fileUploads
      }

      const response = await this.createDeployment(payload as DeploymentCreate)
      return response
    }
  }
})