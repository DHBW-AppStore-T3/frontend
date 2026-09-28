<script setup lang="ts">
import { userApi } from '@/api/user.api'
import { computed, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { extractErrorMessage } from '@/utils/http-error'
import { useRouter } from 'vue-router'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useAppStore } from '@/stores/app.store'
import { useToastStore } from '@/stores/toast.store'
import DeploymentProgressBar from '@/components/DeploymentProgressBar.vue'
import {
  BarChart3,
  ArrowRight,
  ArrowLeft,
  Box,
  Layers
} from 'lucide-vue-next'
import type { AppVariable } from '@/types'
import type { OsResourceType } from '@/api/openstack-resources.api'
import { formatBytes } from '@/utils/format'
import {
  ensureLoaded as ensureOsCacheLoaded,
  getDisplayName as getOsDisplayName,
} from '@/composables/useOpenStackResourceCache'

// ``AppVariable.osType`` may include the pseudo-type ``file``, but the
// cache only knows real OpenStack resource types. Callers below already
// filter ``file`` out at runtime — this helper makes the type system
// agree.
const asOsResourceType = (t: NonNullable<AppVariable['osType']>) =>
  t as OsResourceType

const { t } = useI18n()
const router = useRouter()
const deploymentStore = useDeploymentStore()
const appStore = useAppStore()
const toastStore = useToastStore()

// State
const isLoadingVariables = ref(false)
const appVariables = ref<AppVariable[]>([])
// Local submit lock. Prevents a double-submit between the first click and the
// moment the store sets ``isLoading`` (there's at least one API roundtrip in
// between). Also read by the button display.
const isSubmitting = ref(false)

const selectedApp = computed(() => {
  return appStore.apps.find(a => a.appId === deploymentStore.draft.appId)
})

// Version Display
const versionDisplay = computed(() => {
  const rawTag: any = deploymentStore.draft.releaseTag
  if (rawTag && typeof rawTag === 'object' && rawTag.version) return rawTag.version
  if (typeof rawTag === 'string' && rawTag.trim() !== '') return rawTag
  return 'latest'
})

// Group Mode Display
const groupModeDisplay = computed(() => {
  const mode = deploymentStore.draft.groupMode
  if (mode === 'one') return t('deployment.groups.one')
  if (mode === 'eachUser') return t('deployment.groups.eachUser')
  return t('deployment.groups.custom')
})

// Separate lists for Packer and Terraform variables. Display-name reactivity
// comes from ``getDisplayName``, which reads ``cacheVersion.value`` so Vue
// re-computes once the cache is populated.
//
// Multi-image Packer is the tricky case: step 3 writes such apps' Packer values
// nested under ``draft.variables.packer[<tkey>][<name>]`` instead of flat under
// ``draft.variables[<name>]``, so we mirror that nesting here to avoid falling
// back to ``apiDef.default``. Detection: ``draft.variables.packer`` is a
// non-empty object whose every top-level element is itself an object (a
// ``tkey`` bucket). A false positive would at worst render one skewed line.
const isMultiImagePackerLayout = computed<boolean>(() => {
  const pk = (deploymentStore.draft.variables as any)?.packer
  if (!pk || typeof pk !== 'object' || Array.isArray(pk)) return false
  const keys = Object.keys(pk)
  if (keys.length === 0) return false
  return keys.every((k) => {
    const slot = pk[k]
    return slot && typeof slot === 'object' && !Array.isArray(slot)
  })
})

const _resolvePackerValue = (apiDef: AppVariable): any => {
  const currentVars = deploymentStore.draft.variables as any
  if (isMultiImagePackerLayout.value) {
    const tkey = apiDef.template_key ?? 'default'
    const fromNested = currentVars?.packer?.[tkey]?.[apiDef.name]
    if (fromNested !== undefined) return fromNested
  }
  if (currentVars?.[apiDef.name] !== undefined) return currentVars[apiDef.name]
  return apiDef.default
}

const packerVars = computed(() => {
  const defs = appVariables.value || []
  const result: Array<{label: string, value: string, raw?: string}> = []
  defs.forEach((apiDef: AppVariable) => {
    if (apiDef.source !== 'packer') return
    const val = _resolvePackerValue(apiDef)
    // In multi-image mode prepend the template key so users can tell
    // which image the value belongs to — three packer entries called
    // "region" with no qualifier would be confusing.
    if (isMultiImagePackerLayout.value) {
      const tkey = apiDef.template_key ?? 'default'
      const entry = toSummaryEntry(apiDef, val)
      result.push({ ...entry, label: `[${tkey}] ${entry.label}` })
    } else {
      result.push(toSummaryEntry(apiDef, val))
    }
  })
  return result
})

const terraformVars = computed(() => {
  const currentVars = deploymentStore.draft.variables || {}
  const defs = appVariables.value || []
  const result: Array<{label: string, value: string, raw?: string}> = []
  defs.forEach((apiDef: AppVariable) => {
    // File variables have a separate renderer below; skip them here so the
    // summary doesn't show their ``default = {}`` instead of the uploaded files.
    if (apiDef.osType === 'file') return
    if (apiDef.source === 'terraform') {
      const val = currentVars[apiDef.name] !== undefined ? currentVars[apiDef.name] : apiDef.default
      result.push(toSummaryEntry(apiDef, val))
    }
  })
  return result
})

/**
 * Translate a backend submit-error into a user-facing toast string.
 *
 * The backend signals size / extension / encoding violations with
 * HTTP 413 or 422 and a structured detail body:
 *   { reason: "file_too_large" | "deployment_files_too_large"
 *           | "file_extension_rejected" | "file_b64_invalid"
 *           | "file_size_mismatch",
 *     variable, slot, filename?, limit_bytes?, actual_bytes?, allowed? }
 *
 * Every known reason maps to a dedicated i18n key with the size
 * numbers the user needs to act on. Unknown reasons fall back to the
 * generic submitError string so an unexpected payload still surfaces
 * something rather than ``[object Object]`` (which is what the
 * previous "stringify the detail object" code produced).
 */
function _formatSubmitError(err: any): string {
  const detail = err?.response?.data?.detail
  const fallback = (typeof detail === 'string' ? detail : null)
    ?? err?.message
    ?? t('deployment.summary.submitError')

  if (!detail || typeof detail !== 'object' || !detail.reason) {
    return fallback
  }

  // Filename: prefer the explicit field; fall back to "<variable>/<slot>"
  // so the user can at least identify which input failed when the
  // variable definition omitted the filename (older backend versions).
  const filename = String(
    detail.filename
      ?? (detail.variable && detail.slot ? `${detail.variable}/${detail.slot}` : ''),
  )
  // Bytes-to-MB with one decimal — the user thinks in MB, the API
  // returns bytes; rendering with 1 decimal makes "2.7 MB > 2 MB"
  // useful (an integer "2 MB > 2 MB" would confuse).
  const mb = (b: number) => (Number(b || 0) / (1024 * 1024)).toFixed(1)

  switch (detail.reason) {
    case 'file_too_large':
      return t('deployment.summary.errors.fileTooLarge', {
        filename,
        actualMb: mb(detail.actual_bytes),
        limitMb: mb(detail.limit_bytes),
      })
    case 'deployment_files_too_large':
      return t('deployment.summary.errors.deploymentFilesTooLarge', {
        limitMb: mb(detail.limit_bytes),
      })
    case 'file_extension_rejected':
      return t('deployment.summary.errors.fileExtensionRejected', {
        filename,
        allowed: Array.isArray(detail.allowed) ? detail.allowed.join(', ') : '',
      })
    case 'file_b64_invalid':
      return t('deployment.summary.errors.fileB64Invalid', { filename })
    case 'file_size_mismatch':
      return t('deployment.summary.errors.fileSizeMismatch', { filename })
    default:
      return fallback
  }
}


/**
 * Files section of the summary. One card per ``@openstack:file:*`` variable,
 * with a chip list of uploaded slots showing filename + size (never the base64
 * content). Size is formatted in KB/MB.
 */
const fileVarSummaries = computed(() => {
  const defs = appVariables.value || []
  const uploads = deploymentStore.draft.fileUploads || {}
  const out: Array<{
    name: string
    scope: 'all' | 'team' | 'user'
    chips: Array<{ slot: string; filename: string; size: string }>
  }> = []
  defs.forEach((apiDef: AppVariable) => {
    if (apiDef.osType !== 'file') return
    const slotMap = uploads[apiDef.name] || {}
    const chips: Array<{ slot: string; filename: string; size: string }> = []
    for (const [slotKey, file] of Object.entries(slotMap)) {
      if (!file) continue
      chips.push({
        slot: slotKey,
        filename: file.name,
        size: formatBytes(file.size || 0),
      })
    }
    out.push({
      name: apiDef.name,
      scope: (apiDef.osScope || 'all') as 'all' | 'team' | 'user',
      chips,
    })
  })
  return out
})

/**
 * Builds the summary row for a variable.
 *
 * - Marker variables (osType set): always show the display name from the
 *   frontend cache. In id-mode the raw value (UUID) is added as a ``title``
 *   tooltip, but the submitted value goes to the backend unchanged.
 * - Plain variables: format the raw value.
 */
function toSummaryEntry(def: AppVariable, val: any): {label: string, value: string, raw?: string} {
  // Scoped variables (``varScope = team|user``) arrive as a map
  // (slotKey → value). Render as ``"slotKey: value"`` lines so the
  // summary makes the per-recipient configuration obvious — same
  // detail level the wizard step shows.
  if ((def.varScope === 'team' || def.varScope === 'user') && def.osType !== 'file') {
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      return { label: def.name, value: '-' }
    }
    const entries = Object.entries(val)
    if (entries.length === 0) return { label: def.name, value: '-' }
    const lines = entries.map(([slot, raw]) => {
      let display: string
      if (def.osType) {
        const mode = def.osMode || 'name'
        display = renderOsValue(def.osType, mode, raw, !!def.osMulti)
      } else {
        display = formatValue(raw)
      }
      return `${slot}: ${display}`
    })
    return { label: def.name, value: lines.join(' · ') }
  }

  if (def.osType) {
    const mode = def.osMode || 'name'
    const display = renderOsValue(def.osType, mode, val, !!def.osMulti)
    const rawString = formatValue(val)
    return {
      label: def.name,
      value: display,
      // Only pass raw if it differs from the display, to avoid a duplicate tooltip.
      raw: display !== rawString ? rawString : undefined,
    }
  }
  return { label: def.name, value: formatValue(val) }
}

/**
 * Display string for an OS-marker value. Single → one name; multi → comma-
 * separated names. Falls back to the raw value when the cache has no display
 * name yet.
 */
function renderOsValue(
  osType: NonNullable<AppVariable['osType']>,
  mode: 'id' | 'name',
  val: any,
  isMulti: boolean,
): string {
  if (val === null || val === undefined || val === '') return '-'

  // Split the value — may be a string, CSV, or array. Same as in the picker.
  let parts: string[]
  if (Array.isArray(val)) {
    parts = val.map((v) => String(v).trim()).filter(Boolean)
  } else if (typeof val === 'string') {
    parts = isMulti
      ? val.split(',').map((s) => s.trim()).filter(Boolean)
      : [val.trim()].filter(Boolean)
  } else {
    parts = [String(val)]
  }

  if (parts.length === 0) return '-'

  const names = parts.map((p) => {
    const cached = getOsDisplayName(asOsResourceType(osType), mode, p)
    if (cached) return cached.name
    return p
  })
  return names.join(', ')
}

// Helper to format the values.
const formatValue = (val: any): string => {
  if (typeof val === 'boolean') return val ? t('deployment.summary.yes') : t('deployment.summary.no')
  if (Array.isArray(val)) return val.map(item => String(item).replace(/^"|"$/g, '')).join(', ')
  if (typeof val === 'string') return val.replace(/^["'[]+|["'\]]+$/g, '')
  if (val === null || val === undefined || val === '') return '-'
  return String(val)
}

/**
 * Ensures the display cache is loaded for all OS resource types present in the
 * current variables. Called in the mount path after the variable definitions
 * are available.
 *
 * Race-tolerant: ``ensureLoaded`` deduplicates parallel calls, so the backend
 * only gets one roundtrip per type. Computeds calling ``getDisplayName`` re-run
 * automatically once the cache updates (see ``cacheVersion``).
 */
async function primeOsDisplayCache(defs: AppVariable[]): Promise<void> {
  const types = new Set<NonNullable<AppVariable['osType']>>()
  for (const def of defs) {
    // ``file`` is a frontend-only pseudo-type — the resource cache only
    // tracks real OpenStack resources, so skip it here.
    if (def.osType && def.osType !== 'file') types.add(def.osType)
  }
  if (types.size === 0) return
  await Promise.all([...types].map((t) => ensureOsCacheLoaded(asOsResourceType(t))))
}

// --- 1. Load logic & merge ---
const fetchAndSyncVariables = async () => {
  // A cache hit from step 3 takes absolute priority. When the user
  // reached this page through the wizard, NewDeploymentVariableView has
  // already stored the definitions in the draft, so we can show them
  // immediately — without waiting for ``appStore.fetchApps`` and without
  // tripping the ``selectedApp`` guard below.
  //
  // Earlier versions read the cache only AFTER the guard. As soon as
  // ``selectedApp`` could not be resolved for any reason (apps not yet in
  // the store, direct call to the summary route, filtered app list), the
  // function returned early and ``appVariables.value`` stayed ``[]`` —
  // the summary showed "No Packer/Terraform variables" even though the
  // draft held the definitions.
  const cached = deploymentStore.draft.variableDefinitions
  if (cached && cached.length > 0) {
    appVariables.value = cached
    await primeOsDisplayCache(cached)
    return
  }

  // Make sure apps are loaded.
  if (appStore.apps.length === 0) {
    await appStore.fetchApps()
  }

  if (!selectedApp.value?.appId) {
    console.warn('No app selected or app not found')
    return
  }

  isLoadingVariables.value = true

  try {
    // A. Ensure version (string vs object fix)
    const rawTag: any = deploymentStore.draft.releaseTag
    let versionString = 'latest'
    if (rawTag && typeof rawTag === 'object' && rawTag.version) {
      versionString = rawTag.version
    } else if (typeof rawTag === 'string' && rawTag.trim() !== '') {
      versionString = rawTag
    }

    // B. Load API variables — only reached when the cache from step 3 was
    // empty. The backend endpoint sparse-clones the app repo and parses
    // variables.tf, which can take a few seconds. This fetch is the fallback
    // for deep-link / reload.
    let variables: AppVariable[] = []
    try {
      variables = await appStore.fetchAppVariables(selectedApp.value.appId, versionString)
      deploymentStore.draft.variableDefinitions = variables
    } catch (varError: any) {
      console.warn('Could not load variables:', varError)
      // Re-throw so the outer catch block shows the toast.
      throw varError
    }
    appVariables.value = variables || []

    // C. Parse user input. ``userInputVar`` can be either a JSON string or a
    // Record (type ``Record<string, any> | string``), so branch on the type.
    let userOverrides: Record<string, any> = {}
    const rawUserInput: any = deploymentStore.draft.userInputVar
    if (rawUserInput && typeof rawUserInput === 'object' && !Array.isArray(rawUserInput)) {
      userOverrides = rawUserInput
    } else if (typeof rawUserInput === 'string' && rawUserInput.trim() !== '') {
      try {
        userOverrides = JSON.parse(rawUserInput)
      } catch (e) {
        console.warn('Invalid JSON in userInputVar', e)
        toastStore.addToast({
          message: t('deployment.summary.invalidJson'),
          type: 'error',
        })
      }
    }

    // D. Initialize draft
    if (!deploymentStore.draft.variables) {
      deploymentStore.draft.variables = {}
    }

    // E. Merge
    variables.forEach((v) => {
      if (deploymentStore.draft.variables![v.name] === undefined && v.default !== undefined) {
        deploymentStore.draft.variables![v.name] = v.default
      }
    })

    Object.keys(userOverrides).forEach(key => {
       deploymentStore.draft.variables![key] = userOverrides[key]
    })

    // F. Prime the display cache for OS-marker variables so the summary cards
    // show resource names instead of UUIDs. Async: the initial pass shows UUIDs
    // and the computeds re-render names once the cache lands.
    primeOsDisplayCache(appVariables.value)

  } catch (error: any) {
    console.error(error)
    let msg = t('deployment.summary.fetchVarsError')
    if (error.response?.status === 500) msg = t('deployment.summary.fetchVarsError500')
    
    toastStore.addToast({ 
        message: msg, 
        type: 'error' 
    })
  } finally {
    isLoadingVariables.value = false
  }
}

onMounted(() => {
  fetchAndSyncVariables()
})

// --- Actions ---
const handleCustomize = () => {
  // Navigate to the variables page.
  router.push({ name: 'deployment.variables' })
}

const handleDeploy = async () => {
  // Local lock before any await. The store's isLoading flag only flips inside
  // ``submitDraft``, so a second click before then would start a second
  // deployment-creation roundtrip.
  if (isSubmitting.value) return
  isSubmitting.value = true

  try {
    // 1) Keycloak ID → user ID mapping. Kept local and not written back into
    //    the draft, otherwise the draft IDs would no longer match the
    //    Keycloak-keyed ``studentCache`` after a failed submit.
    let backendUsers: any[] = []
    try {
      const res = await userApi.list()
      backendUsers = res.data || []
    } catch (err: any) {
      const detail = extractErrorMessage(err, t('deployment.summary.fetchUsersError'))
      toastStore.addToast({ message: detail, type: 'error' })
      return
    }

    const keycloakToUserId = new Map<string, string>()
    backendUsers.forEach((u: any) => {
      if (u.keycloak_id) keycloakToUserId.set(u.keycloak_id, u.userId)
      keycloakToUserId.set(u.userId, u.userId) // fallback: already a userId
    })

    // 2) Local copies of the ID lists with translated IDs.
    const sourceAssignments = (deploymentStore.draft.assignments || {}) as Record<number, string[]>
    const mappedAssignments: Record<number, string[]> = {}
    Object.entries(sourceAssignments).forEach(([teamIdx, arr]) => {
      mappedAssignments[Number(teamIdx)] = (arr || [])
        .map((id: string) => keycloakToUserId.get(id) || id)
        .filter(Boolean)
    })

    const mappedStudentIds = (deploymentStore.draft.studentIds || [])
      .map((id: string) => keycloakToUserId.get(id) || id)
      .filter(Boolean)

    // 3) Patch the draft transiently for ``submitDraft`` only, then roll back
    //    so the wizard still shows the original Keycloak IDs on failure.
    const originalAssignments = deploymentStore.draft.assignments
    const originalStudentIds = deploymentStore.draft.studentIds
    deploymentStore.draft.assignments = mappedAssignments
    deploymentStore.draft.studentIds = mappedStudentIds

    let deployment: any
    try {
      deployment = await deploymentStore.submitDraft()
    } catch (err: any) {
      // Roll the draft back to Keycloak IDs so the user sees their selection
      // again in steps 2/3.
      deploymentStore.draft.assignments = originalAssignments
      deploymentStore.draft.studentIds = originalStudentIds
      // Backend returns ``{detail: {reason, variable, slot, limit_bytes,
      // actual_bytes, ...}}`` for size/extension/encoding violations (413/422).
      // Branch on ``reason`` and format a localized message with the size numbers.
      const message = _formatSubmitError(err)
      toastStore.addToast({ message, type: 'error' })
      return
    }

    if (deployment?.deploymentId) {
      // Created successfully → reset the draft so the next wizard run starts clean.
      deploymentStore.resetDraft()
      toastStore.addToast({ message: t('deployment.summary.submitSuccess'), type: 'success' })
      await router.push({ name: 'deployments.list' })
    }
  } finally {
    isSubmitting.value = false
  }
}

const handleBack = () => {
    // Back leads to the variables page (step 3).
    router.push({ name: 'deployment.variables' })
}
</script>

<template>
  <div class="bg-white rounded-2xl p-10 border shadow-sm max-w-7xl mx-auto min-h-[600px] flex flex-col">

    <div class="mb-8">
      <div class="flex items-center gap-3 mb-6">
        <h1 class="text-3xl font-bold text-gray-900">
          {{ t('deployment.title') }}
        </h1>
        <BarChart3 :size="32" class="text-emerald-600" />
      </div>

      <DeploymentProgressBar :current-step="4" />
      <div class="border-b border-gray-100 mt-4"></div>
    </div>

    <div class="text-center mb-8">
      <h2 class="text-2xl font-bold text-gray-900">
        {{ t('deployment.summary.title') }}
      </h2>
      <p class="text-gray-600 mt-2">{{ t('deployment.summary.subtitle') }}</p>
    </div>

    <div v-if="isLoadingVariables" class="flex flex-col items-center justify-center py-12 gap-3">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      <span class="text-gray-500 text-sm">{{ t('deployment.summary.loadingConfig') }}</span>
    </div>

    <div v-else class="flex-grow space-y-6">
      
      <div class="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 border-2 border-emerald-200">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">1</div>
          <h3 class="text-xl font-bold text-gray-900">{{ t('deployment.summary.baseConfigTitle') }}</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white rounded-lg p-4 border border-emerald-100">
            <p class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">{{ t('deployment.summary.deploymentNameLabel') }}</p>
            <p class="text-lg font-bold text-gray-900">{{ deploymentStore.draft.name || '-' }}</p>
          </div>
          <div class="bg-white rounded-lg p-4 border border-emerald-100">
            <p class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">{{ t('deployment.summary.appLabel') }}</p>
            <div class="flex items-center gap-2">
              <img
                v-if="selectedApp?.image"
                :src="selectedApp.image"
                :alt="selectedApp.name"
                class="w-7 h-7 object-contain rounded"
              />
              <p class="text-lg font-bold text-emerald-700">{{ selectedApp?.name || t('deployment.summary.appNotFound') }}</p>
            </div>
          </div>
          <div class="bg-white rounded-lg p-4 border border-emerald-100">
            <p class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">{{ t('deployment.summary.versionLabel') }}</p>
            <p class="text-lg font-bold text-gray-900">{{ versionDisplay }}</p>
          </div>
        </div>
          <div class="mt-4 bg-white rounded-lg p-4 border border-emerald-100">
            <p class="text-xs text-gray-500 mb-2 uppercase tracking-wider font-semibold">{{ t('deployment.summary.selectedStudents', { count: deploymentStore.draft.studentIds.length }) }}</p>
            <div class="flex flex-wrap gap-2">
              <span v-for="studentId in deploymentStore.draft.studentIds" :key="studentId" 
                class="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium border border-emerald-200">
                {{
                  (deploymentStore.studentCache.get(studentId)?.firstName || deploymentStore.studentCache.get(studentId)?.lastName)
                    ? `${deploymentStore.studentCache.get(studentId)?.firstName || ''} ${deploymentStore.studentCache.get(studentId)?.lastName || ''}`.trim()
                    : (deploymentStore.studentCache.get(studentId)?.username || deploymentStore.studentCache.get(studentId)?.email || studentId)
                }}
              </span>
            </div>
          </div>
      </div>

      <div class="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border-2 border-blue-200">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">2</div>
          <h3 class="text-xl font-bold text-gray-900">{{ t('deployment.summary.teamAssignmentTitle') }}</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div class="bg-white rounded-lg p-4 border border-blue-100">
            <p class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">{{ t('deployment.summary.teamCountLabel') }}</p>
            <p class="text-2xl font-bold text-blue-700">{{ deploymentStore.draft.groupCount }}</p>
          </div>
          <div class="bg-white rounded-lg p-4 border border-blue-100">
            <p class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">{{ t('deployment.summary.modeLabel') }}</p>
            <p class="text-lg font-bold text-gray-900">{{ groupModeDisplay }}</p>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="(assignments, index) in deploymentStore.draft.assignments" :key="index" 
            class="bg-white rounded-lg p-4 border-2 border-blue-200 hover:border-blue-400 transition-colors">
            <div class="flex items-center justify-between mb-3">
              <p class="font-bold text-gray-900">{{ deploymentStore.draft.groupNames[index] || t('deployment.assignment.vmDefaultName', { index: index + 1 }) }}</p>
              <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                {{ t('deployment.assignment.userCount', { count: assignments?.length || 0 }) }}
              </span>
            </div>
            <div class="space-y-1 max-h-32 overflow-y-auto">
              <div v-for="studentId in assignments" :key="studentId" 
                class="text-sm text-gray-700 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                {{
                  (deploymentStore.studentCache && deploymentStore.studentCache.get(studentId)?.firstName || deploymentStore.studentCache.get(studentId)?.lastName)
                    ? `${deploymentStore.studentCache.get(studentId)?.firstName || ''} ${deploymentStore.studentCache.get(studentId)?.lastName || ''}`.trim()
                    : (deploymentStore.studentCache && (deploymentStore.studentCache.get(studentId)?.username || deploymentStore.studentCache.get(studentId)?.email) || studentId)
                }}
              </div>
              <p v-if="!assignments || assignments.length === 0" class="text-xs text-gray-400 italic">{{ t('deployment.summary.noUsersAssigned') }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm">3</div>
            <h3 class="text-xl font-bold text-gray-900">{{ t('deployment.summary.variablesConfigTitle') }}</h3>
          </div>
          <button @click="handleCustomize"
            class="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-100 text-purple-700 font-semibold hover:bg-purple-200 transition-colors border border-purple-300 text-sm">
            <ArrowRight :size="16" />
            {{ t('deployment.summary.editBtn') }}
          </button>
        </div>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="bg-white rounded-lg border-2 border-blue-200 overflow-hidden">
            <div class="bg-blue-100 px-4 py-2 border-b border-blue-200 flex items-center gap-2">
              <Box :size="18" class="text-blue-700" />
              <h4 class="font-bold text-blue-900 text-sm">{{ t('deployment.summary.packerVars') }}</h4>
              <span class="ml-auto text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                {{ packerVars.length }}
              </span>
            </div>
            <div class="p-4 space-y-2 max-h-64 overflow-y-auto">
              <div v-for="item in packerVars" :key="item.label"
                class="flex justify-between items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                <span class="text-sm font-semibold text-gray-700 flex-shrink-0">{{ item.label }}</span>
                <span
                  class="text-sm text-gray-900 font-medium text-right break-all"
                  :title="item.raw ? t('deployment.summary.submittedValue', { value: item.raw }) : undefined"
                >
                  {{ item.value }}
                </span>
              </div>
              <p v-if="packerVars.length === 0" class="text-sm text-gray-400 italic text-center py-4">
                {{ t('deployment.summary.noPackerVars') }}
              </p>
            </div>
          </div>

          <div class="bg-white rounded-lg border-2 border-purple-200 overflow-hidden">
            <div class="bg-purple-100 px-4 py-2 border-b border-purple-200 flex items-center gap-2">
              <Layers :size="18" class="text-purple-700" />
              <h4 class="font-bold text-purple-900 text-sm">{{ t('deployment.summary.terraformVars') }}</h4>
              <span class="ml-auto text-xs bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-bold">
                {{ terraformVars.length }}
              </span>
            </div>
            <div class="p-4 space-y-2 max-h-64 overflow-y-auto">
              <div v-for="item in terraformVars" :key="item.label"
                class="flex justify-between items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                <span class="text-sm font-semibold text-gray-700 flex-shrink-0">{{ item.label }}</span>
                <span
                  class="text-sm text-gray-900 font-medium text-right break-all"
                  :title="item.raw ? t('deployment.summary.submittedValue', { value: item.raw }) : undefined"
                >
                  {{ item.value }}
                </span>
              </div>
              <p v-if="terraformVars.length === 0" class="text-sm text-gray-400 italic text-center py-4">
                {{ t('deployment.summary.noTerraformVars') }}
              </p>
            </div>
          </div>

          <!-- Files section. One card per file variable; chips list the
               uploaded slots (filename + size). Hidden when the app declares
               no file variables. -->
          <div
            v-if="fileVarSummaries.length > 0"
            class="bg-white rounded-lg border-2 border-amber-200 overflow-hidden col-span-1 md:col-span-2"
          >
            <div class="bg-amber-100 px-4 py-2 border-b border-amber-200 flex items-center gap-2">
              <Layers :size="18" class="text-amber-700" />
              <h4 class="font-bold text-amber-900 text-sm">Hochgeladene Dateien</h4>
              <span class="ml-auto text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                {{ fileVarSummaries.reduce((acc, v) => acc + v.chips.length, 0) }}
              </span>
            </div>
            <div class="p-4 space-y-3">
              <div v-for="entry in fileVarSummaries" :key="entry.name">
                <div class="text-xs font-semibold text-gray-700 mb-1">
                  {{ entry.name }}
                  <span class="text-[10px] font-normal text-gray-500 ml-1">
                    (Scope: {{ entry.scope }})
                  </span>
                </div>
                <div v-if="entry.chips.length === 0" class="text-xs text-gray-400 italic">
                  Keine Datei hochgeladen
                </div>
                <div v-else class="flex flex-wrap gap-1.5">
                  <span
                    v-for="chip in entry.chips"
                    :key="`${entry.name}::${chip.slot}`"
                    class="inline-flex items-center gap-1 text-xs bg-amber-50 border border-amber-200 text-amber-900 px-2 py-1 rounded"
                  >
                    <span class="font-medium">{{ chip.filename }}</span>
                    <span class="text-amber-700">·</span>
                    <span>{{ chip.size }}</span>
                    <span v-if="entry.scope !== 'all'" class="text-amber-700">·</span>
                    <span v-if="entry.scope !== 'all'" class="text-[10px] text-amber-700">
                      {{ chip.slot }}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <div class="flex justify-between items-center mt-8 pt-6 border-t-2 border-gray-200">
      <button @click="handleBack"
        class="flex items-center gap-2 px-8 py-3 rounded-full bg-gray-100 text-gray-600 font-semibold hover:bg-gray-200 transition-colors">
        <ArrowLeft :size="18" />
        {{ t('deployment.actions.back') }}
      </button>

      <button @click="handleDeploy"
        :disabled="isLoadingVariables || isSubmitting || deploymentStore.isLoading"
        class="flex items-center gap-3 px-10 py-3 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-xl shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed">

        <span v-if="isSubmitting || deploymentStore.isLoading" class="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
        <span v-if="isSubmitting || deploymentStore.isLoading">{{ t('deployment.summary.creating') }}</span>
        <span v-else>{{ t('deployment.actions.deploy') }}</span>
      </button>
    </div>

  </div>
</template>