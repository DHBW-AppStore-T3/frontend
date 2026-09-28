<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useAppStore } from '@/stores/app.store'
import { useToast } from '@/composables/useToast'
import DeploymentProgressBar from '@/components/DeploymentProgressBar.vue'
import VariableInput from '@/components/VariableInput.vue'
import ScopeBadge from '@/components/ui/ScopeBadge.vue'
import {
  ArrowRight,
  ArrowLeft,
  Info,
  Box,
  Layers,
  AlertTriangle,
  // Plus - removed
} from 'lucide-vue-next'
import type { AppVariable, DeploymentFile } from '@/types'
import FileDropZone from '@/components/FileDropZone.vue'

const { t } = useI18n()
const router = useRouter()
const deploymentStore = useDeploymentStore()
const appStore = useAppStore()
const toast = useToast()

// --- State ---
const isLoading = ref(false)
const variables = ref<AppVariable[]>([])
const formValues = ref<Record<string, any>>({})
const activeTooltip = ref<string | null>(null)

// --- Helper: Type Checks ---
const isBool = (type: string) => ['bool', 'boolean'].includes(type.toLowerCase())
const isNumber = (type: string) => ['number', 'int', 'integer'].includes(type.toLowerCase())
const isList = (type: string) => type.toLowerCase().startsWith('list') || type.toLowerCase().startsWith('set') || type.toLowerCase().startsWith('array')

// Does the variable have value-help metadata (osType)? The picker takes
// precedence over type-based input, including ``list(string)`` variables.
// ``osType`` is set by the backend only when the variable's description carries
// an ``@openstack:<type>`` marker.
//
// File variables (``osType === 'file'``) are excluded here: their renderer is
// the file-specific FileDropZone branch, not the OpenStackResourcePicker.
// True when the variable is marked ``@openstack:file:<scope>``.
const isFileVar = (v: AppVariable): boolean => v.osType === 'file'

// True when the variable has a per-variable scope other than ``all``.
const effectiveScope = (v: AppVariable): 'all' | 'team' | 'user' => {
  return (v.varScope || v.osScope || 'all') as 'all' | 'team' | 'user'
}
const isScoped = (v: AppVariable): boolean => effectiveScope(v) !== 'all'

/** Slot keys for a scoped variable. */
const slotKeysFor = (v: AppVariable): string[] => {
  const scope = effectiveScope(v)
  if (scope === 'team') return wizardTeams.value.map((t) => t.name)
  if (scope === 'user') {
    const keys: string[] = []
    wizardTeams.value.forEach((t) =>
      t.members.forEach((m) => keys.push(userSlotKey(t.name, m.username))),
    )
    return keys
  }
  return []
}

/** Single-path API for the v-model of a scoped non-file variable. */
const getScopedValue = (varName: string, slotKey: string): any => {
  const bag = formValues.value[varName]
  if (bag && typeof bag === 'object' && !Array.isArray(bag)) return bag[slotKey] ?? ''
  return ''
}
const setScopedValue = (varName: string, slotKey: string, value: any): void => {
  const bag = formValues.value[varName]
  if (!bag || typeof bag !== 'object' || Array.isArray(bag)) {
    formValues.value[varName] = {}
  }
  formValues.value[varName][slotKey] = value
}

/**
 * Builds the initial slot map for a scoped variable (``varScope = team|user``).
 * Distributes a scalar or list default across every team/user slot so a scoped
 * default is visible and effective per slot.
 *
 * Object defaults (e.g. ``map(string)`` with default ``{}``) yield no per-slot
 * value and stay an empty map. Existing slot values (returning via "Back") are
 * not overwritten.
 */
const seedScopedDefault = (
  v: AppVariable,
  existing?: Record<string, any>,
): Record<string, any> => {
  const map: Record<string, any> =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...existing }
      : {}
  const def = v.default
  const hasSeedableDefault =
    def !== undefined &&
    def !== null &&
    (typeof def === 'string' ||
      typeof def === 'number' ||
      typeof def === 'boolean' ||
      Array.isArray(def))
  if (!hasSeedableDefault) return map
  // list(...) defaults as a comma string, consistent with the non-scoped textarea widget.
  const seed = isList(v.type) && Array.isArray(def) ? def.join(', ') : def
  for (const slot of slotKeysFor(v)) {
    const cur = map[slot]
    if (cur === undefined || cur === null || cur === '') {
      map[slot] = seed
    }
  }
  return map
}

/** ``accept`` attribute for a file variable. */
const fileAcceptFor = (v: AppVariable): string => {
  if (!v.fileExtensions || v.fileExtensions.length === 0) return '*'
  return v.fileExtensions.map((e) => `.${e}`).join(',')
}

// Subnet filter
const findNetworkValueForSubnet = (_subnet: AppVariable): string | null => {
  const networkVar = variables.value.find(
    (v) => v.osType === 'network' && v.osMode === 'id',
  )
  if (!networkVar) return null
  const val = formValues.value[networkVar.name]
  if (typeof val === 'string' && val.trim()) return val
  return null
}

const toggleTooltip = (name: string) => {
  if (activeTooltip.value === name) activeTooltip.value = null
  else activeTooltip.value = name
}

const focusInput = (name: string) => {
  const el = document.getElementById(name)
  if (el) el.focus()
}

// ----------------------------------------------------------------
// FILE-VARIABLE WIRING
// ----------------------------------------------------------------

interface WizardTeamMember {
  userId: string
  username: string
}
interface WizardTeam {
  name: string
  members: WizardTeamMember[]
}

const wizardTeams = computed<WizardTeam[]>(() => {
  const groupNames = deploymentStore.draft.groupNames || []
  const assignments = deploymentStore.draft.assignments || {}
  const out: WizardTeam[] = []
  groupNames.forEach((rawName, idx) => {
    const teamName = rawName || `Team-${idx + 1}`
    const memberIds: string[] = (assignments as any)[idx] || []
    const members: WizardTeamMember[] = memberIds.map((uid) => {
      const cached = deploymentStore.studentCache.get(String(uid))
      const username = cached?.username
        || cached?.email?.split('@')[0]
        || cached?.firstName
        || String(uid).slice(0, 8)
      return { userId: String(uid), username }
    })
    out.push({ name: teamName, members })
  })
  return out
})

const userSlotKey = (teamName: string, username: string) =>
  `${teamName}-${username}`

const formatSlotLabel = (
  variable: AppVariable,
  slotKey: string,
): string => {
  const scope = effectiveScope(variable)
  if (scope === 'team') return `Team „${slotKey}"`
  if (scope === 'user') {
    const teamNames = wizardTeams.value.map((t) => t.name)
    const sorted = [...teamNames].sort((a, b) => b.length - a.length)
    for (const team of sorted) {
      if (slotKey === team) return `Team „${team}"`
      if (slotKey.startsWith(team + '-')) {
        const user = slotKey.slice(team.length + 1)
        return `Team „${team}" → ${user}`
      }
    }
    const sep = slotKey.lastIndexOf('-')
    if (sep > 0) {
      const team = slotKey.slice(0, sep)
      const user = slotKey.slice(sep + 1)
      return `Team „${team}" → ${user}`
    }
  }
  return slotKey
}

const getFileSlot = (varName: string, slotKey: string): DeploymentFile | null => {
  const bag = deploymentStore.draft.fileUploads?.[varName]
  return (bag && bag[slotKey]) || null
}

const setFileSlot = (
  varName: string,
  slotKey: string,
  value: DeploymentFile | null,
) => {
  const draft = deploymentStore.draft
  if (!draft.fileUploads) draft.fileUploads = {}
  if (!draft.fileUploads[varName]) draft.fileUploads[varName] = {}
  if (value === null) {
    delete draft.fileUploads[varName][slotKey]
  } else {
    draft.fileUploads[varName][slotKey] = value
  }
}

// ----------------------------------------------------------------
// VARIABLES BY TEMPLATE
// ----------------------------------------------------------------

const packerByTemplate = computed<Record<string, AppVariable[]>>(() => {
  const out: Record<string, AppVariable[]> = {}
  for (const v of variables.value) {
    if (v.source !== 'packer') continue
    const key = v.template_key ?? 'default'
    ;(out[key] ??= []).push(v)
  }
  return out
})

const templateKeys = computed(() => Object.keys(packerByTemplate.value).sort())

const packerVariables = computed(() =>
  Object.values(packerByTemplate.value).flat(),
)

const terraformVariables = computed(() =>
  variables.value.filter(v => v.source === 'terraform')
)

const isMultiImage = computed(
  () => templateKeys.value.length > 1 || (templateKeys.value.length === 1 && templateKeys.value[0] !== 'default'),
)

const packerFormKey = (variable: AppVariable): string => {
  const tkey = variable.template_key ?? 'default'
  if (!isMultiImage.value || tkey === 'default') return variable.name
  return `${tkey}.${variable.name}`
}

// --- CORE LOGIC: value normalization for comparison ---
const normalizeValue = (val: any, type: string) => {
  if (val === null || val === undefined) {
    if (isList(type)) return []
    if (isBool(type)) return false
    return ""
  }

  if (isList(type)) {
    let arr: unknown[]
    if (Array.isArray(val)) {
      arr = val
    } else if (typeof val === 'string') {
      arr = val.split(',').map(s => s.trim()).filter(s => s !== '')
    } else {
      arr = [String(val)]
    }
    return JSON.stringify(arr.sort())
  }

  if (isNumber(type)) {
    if (val === '') return null
    return Number(val)
  }

  if (isBool(type)) {
    return Boolean(val)
  }

  return String(val).trim()
}

// --- Data Loading ---
onMounted(async () => {
  if (!deploymentStore.draft.appId) {
    router.replace('/apps')
    return
  }

  if (deploymentStore.draft.variableDefinitions && deploymentStore.draft.variableDefinitions.length > 0) {
    variables.value = deploymentStore.draft.variableDefinitions
    // Re-hydrate ``formValues`` from the draft. The form binding uses
    // ``packerFormKey(v)`` throughout, but ``handleNext`` stores Packer values
    // differently by mode:
    //   - single-image: ``draft.variables[v.name]`` (flat)
    //   - multi-image : ``draft.variables.packer[<tkey>][<name>]`` (nested)
    // So we map explicitly back to the form-key convention and fill missing
    // values from ``v.default``.
    const stored = (deploymentStore.draft.variables || {}) as Record<string, any>
    const restored: Record<string, any> = {}
    for (const v of variables.value) {
      // File variables are rendered separately in the drop zone (they go via
      // draft.fileUploads), not through formValues.
      if (v.osType === 'file') continue
      const key = v.source === 'packer' ? packerFormKey(v) : v.name
      let stored_value: any
      if (v.source === 'packer' && isMultiImage.value) {
        const tkey = v.template_key ?? 'default'
        stored_value = stored.packer?.[tkey]?.[v.name]
      } else if (v.source === 'packer') {
        stored_value = stored.packer?.[v.name] ?? stored[v.name]
      } else {
        stored_value = stored[v.name]
      }
      // Scoped variables are a slot map, not a scalar. Restore the existing map
      // and top up new slots with the author default; otherwise seed fresh.
      if (isScoped(v)) {
        const existingMap =
          stored_value && typeof stored_value === 'object' && !Array.isArray(stored_value)
            ? stored_value
            : undefined
        restored[key] = seedScopedDefault(v, existingMap)
        continue
      }
      if (stored_value !== undefined && stored_value !== null) {
        restored[key] = stored_value
      } else if (v.default !== undefined && v.default !== null) {
        restored[key] = v.default
      } else {
        restored[key] = ''
      }
      // List values are stored in the draft as an array, but the ``<textarea>``
      // widget expects a comma string, so normalise to ``"a, b"`` on rehydration.
      if (isList(v.type) && Array.isArray(restored[key])) {
        restored[key] = restored[key].join(', ')
      }
    }
    formValues.value = restored
    return
  }

  isLoading.value = true

  try {
    const rawTag: any = deploymentStore.draft.releaseTag
    const version = (typeof rawTag === 'object' && rawTag.version) ? rawTag.version : rawTag || 'latest'
    
    const rawVariables = await appStore.fetchAppVariables(deploymentStore.draft.appId, version)
    
    const uniqueVariablesMap = new Map<string, AppVariable>()
    rawVariables.forEach(v => {
      const dedupKey = v.source === 'packer'
        ? `${v.template_key ?? 'default'}.${v.name}`
        : v.name
      if (!uniqueVariablesMap.has(dedupKey)) uniqueVariablesMap.set(dedupKey, v)
    })
    variables.value = Array.from(uniqueVariablesMap.values())
    deploymentStore.draft.variableDefinitions = variables.value

    const osTypesToPrime = new Set<string>()
    for (const v of variables.value) {
      if (v.osType && v.osType !== 'file') osTypesToPrime.add(v.osType)
    }
    if (osTypesToPrime.size > 0) {
      const { ensureLoaded } = await import('@/composables/useOpenStackResourceCache')
      await Promise.allSettled(
        Array.from(osTypesToPrime).map((t) => ensureLoaded(t as any)),
      )
    }

    let savedValues: Record<string, any> = {}
    const rawUserInput: any = deploymentStore.draft.userInputVar
    if (rawUserInput && typeof rawUserInput === 'object' && !Array.isArray(rawUserInput)) {
      savedValues = rawUserInput
    } else if (typeof rawUserInput === 'string' && rawUserInput.trim() !== '') {
      try {
        savedValues = JSON.parse(rawUserInput)
      } catch (e) {
        console.warn('Invalid JSON in userInputVar', e)
        toast.error(t('deployment.summary.invalidJson'))
      }
    }

    variables.value.forEach(v => {
      let valToSet: any = ''
      const storageKey = v.source === 'packer' ? packerFormKey(v) : v.name

      if (savedValues[storageKey] !== undefined) {
        valToSet = savedValues[storageKey]
      } else if (savedValues[v.name] !== undefined) {
        valToSet = savedValues[v.name]
      }
      else if (v.default !== undefined && v.default !== null) {
        valToSet = v.default
      }

      if (isScoped(v) && v.osType !== 'file') {
        // Reuse an existing slot map (e.g. from savedValues) or an empty map,
        // and in both cases distribute the author default across every
        // team/user slot (see seedScopedDefault).
        const existingMap =
          valToSet && typeof valToSet === 'object' && !Array.isArray(valToSet)
            ? valToSet
            : undefined
        formValues.value[storageKey] = seedScopedDefault(v, existingMap)
        return
      }
      
      if (isList(v.type) && Array.isArray(valToSet)) {
        valToSet = valToSet.join(', ')
      }

      if (valToSet === '' || valToSet === null || valToSet === undefined) {
         if (isBool(v.type)) valToSet = false
         else if (isNumber(v.type)) valToSet = ''
         else valToSet = ''
      }

      formValues.value[storageKey] = valToSet
    })

  } catch (error: any) {
    console.error(error)
    toast.error(t('deployment.summary.fetchVarsError'))
  } finally {
    isLoading.value = false
  }

  const bad = variables.value.filter((v) => v.markerError)
  if (bad.length > 0) {
    const lines = bad.map((v) => {
      const loc = v.markerError?.location ? ` (${v.markerError.location})` : ''
      return `• ${v.markerError?.variable}${loc}: ${v.markerError?.message}`
    })
    toast.error(
      t('deployment.variables.markerErrorToast', { count: bad.length, lines: lines.join('\n') })
    )
  }
})

// --- Actions ---
const handleNext = () => {
  try {
    const changedValues: Record<string, any> = {}
    const allValues: Record<string, any> = {}
    
    const packerNested: Record<string, Record<string, any>> = {}
    const packerNestedAll: Record<string, Record<string, any>> = {}

    variables.value.forEach(v => {
      if (v.osType === 'file') return

      const storageKey = v.source === 'packer' ? packerFormKey(v) : v.name
      const tkey = v.template_key ?? 'default'
      const isMultiPacker = v.source === 'packer' && isMultiImage.value

      if (isScoped(v)) {
        const map = formValues.value[storageKey]
        const cleanMap: Record<string, any> = {}
        if (map && typeof map === 'object' && !Array.isArray(map)) {
          for (const [slotKey, raw] of Object.entries(map)) {
            if (raw === undefined || raw === null) continue
            if (typeof raw === 'string' && raw.trim() === '') continue
            let val: any = raw
            if (isList(v.type) && typeof raw === 'string') {
              val = raw.split(',').map((s) => s.trim()).filter((s) => s !== '')
            } else if (isNumber(v.type) && raw !== '') {
              val = Number(raw)
            }
            cleanMap[slotKey] = val
          }
        }
        if (isMultiPacker) {
          if (Object.keys(cleanMap).length > 0) {
            ;(packerNested[tkey] ??= {})[v.name] = cleanMap
          }
          ;(packerNestedAll[tkey] ??= {})[v.name] = cleanMap
        } else {
          if (Object.keys(cleanMap).length > 0) {
            changedValues[v.name] = cleanMap
          }
          allValues[v.name] = cleanMap
        }
        return
      }

      const currentValueRaw = formValues.value[storageKey]
      const defaultValueRaw = v.default

      const normalizedCurrent = normalizeValue(currentValueRaw, v.type)
      const normalizedDefault = normalizeValue(defaultValueRaw, v.type)

      let valueToSave: any = currentValueRaw
      if (isList(v.type) && typeof currentValueRaw === 'string') {
        valueToSave = currentValueRaw.split(',').map(s => s.trim()).filter(s => s !== '')
      } else if (isNumber(v.type) && currentValueRaw !== '') {
        valueToSave = Number(currentValueRaw)
      }

      const changed = normalizedCurrent !== normalizedDefault

      if (isMultiPacker) {
        if (changed) {
          ;(packerNested[tkey] ??= {})[v.name] = valueToSave
        }
        ;(packerNestedAll[tkey] ??= {})[v.name] = valueToSave
      } else {
        if (changed) changedValues[v.name] = valueToSave
        allValues[v.name] = valueToSave
      }
    })

    if (isMultiImage.value && Object.keys(packerNested).length > 0) {
      changedValues.packer = packerNested
    }
    if (isMultiImage.value && Object.keys(packerNestedAll).length > 0) {
      allValues.packer = packerNestedAll
    }

    deploymentStore.draft.userInputVar = JSON.stringify(changedValues) as any
    deploymentStore.draft.variables = allValues
    router.push({ name: 'deployment.summary' })
  } catch (e) {
    console.error(e)
    toast.error(t('deployment.variables.saveError'))
  }
}

const handleBack = () => {
  router.push({ name: 'deployment.teams' })
}

// ----------------------------------------------------------------
// REQUIRED-GATING
// ----------------------------------------------------------------
const isEmptyValue = (val: any): boolean => {
  if (val === undefined || val === null) return true
  if (typeof val === 'string' && val.trim() === '') return true
  if (Array.isArray(val) && val.length === 0) return true
  return false
}

const missingRequired = computed<string[]>(() => {
  const missing: string[] = []
  for (const v of variables.value) {
    if (!v.required) continue
    if (v.osType === 'file') continue 
    const storageKey = v.source === 'packer' ? packerFormKey(v) : v.name
    if (isScoped(v)) {
      const map = (formValues.value[storageKey] ?? {}) as Record<string, any>
      const slots = slotKeysFor(v)
      if (slots.length === 0) {
        missing.push(v.name)
        continue
      }
      for (const slot of slots) {
        if (isEmptyValue(map[slot])) {
          missing.push(`${v.name} (${slot})`)
        }
      }
    } else {
      if (isEmptyValue(formValues.value[storageKey])) missing.push(v.name)
    }
  }
  return missing
})

const canSubmit = computed(() => missingRequired.value.length === 0)

// ----------------------------------------------------------------
// TEAM-RENAME RECONCILIATION
// ----------------------------------------------------------------
watch(
  wizardTeams,
  (_newTeams, _oldTeams) => {
    if (!variables.value.length) return
    const dropped: string[] = []
    for (const v of variables.value) {
      if (!isScoped(v)) continue
      if (v.osType === 'file') continue
      const storageKey = v.source === 'packer' ? packerFormKey(v) : v.name
      const map = formValues.value[storageKey]
      if (!map || typeof map !== 'object' || Array.isArray(map)) continue
      const validSlots = new Set(slotKeysFor(v))
      for (const key of Object.keys(map)) {
        if (!validSlots.has(key)) {
          dropped.push(`${v.name} → ${key}`)
          delete (map as Record<string, any>)[key]
        }
      }
    }
    if (dropped.length > 0) {
      toast.info(
        t('deployment.variables.teamRenameToast', { count: dropped.length, lines: dropped.join('\n') })
      )
    }
  },
  { deep: true },
)
</script>

<template>
  <div class="bg-white rounded-2xl p-10 border shadow-sm max-w-5xl mx-auto min-h-[600px] flex flex-col">

    <div class="mb-6">
      <DeploymentProgressBar :current-step="3" class="mb-8" />
      <div class="text-center">
        <h1 class="text-3xl font-bold text-gray-900">{{ t('deployment.summary.variablesConfigTitle') }}</h1>
        <p class="text-emerald-600 font-medium mt-2 text-lg">
          {{ t('deployment.summary.appLabel') }}: {{ deploymentStore.draft.name || t('deployment.variables.unnamed') }}
        </p>
      </div>
    </div>

    <div class="flex-grow w-full max-w-7xl mx-auto mt-6">
      
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-20">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-3"></div>
        <span class="text-gray-400">{{ t('deployment.variables.loading') }}</span>
      </div>

      <div v-else-if="variables.length === 0" class="text-center py-12 text-gray-500 italic bg-gray-50 rounded-xl border border-dashed">
        {{ t('deployment.variables.noVariables') }}
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200 overflow-hidden">
          <div class="bg-blue-600 text-white px-6 py-4 flex items-center gap-3">
            <Box :size="24" />
            <div>
              <h2 class="text-xl font-bold">{{ t('deployment.summary.packerVars') }}</h2>
              <p class="text-xs text-blue-100 mt-0.5">{{ t('deployment.variables.packerDesc') }}</p>
            </div>
          </div>
          
          <div class="p-6 space-y-6 max-h-[600px] overflow-y-auto">
            <div v-if="packerVariables.length === 0" class="text-center py-8 text-blue-600 italic">
              {{ t('deployment.summary.noPackerVars') }}
            </div>

            <template v-for="tkey in templateKeys" :key="tkey">
              <div
                v-if="templateKeys.length > 1"
                class="-mx-6 px-6 py-2 bg-blue-50/70 border-y border-blue-200 text-sm font-semibold text-blue-900"
              >
                Image: <code class="font-mono">{{ tkey }}</code>
              </div>

              <div v-for="variable in packerByTemplate[tkey]" :key="`${tkey}.${variable.name}`" class="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
              <div class="flex items-start justify-between gap-2 mb-3">
                <label
                  :for="packerFormKey(variable)"
                  @click.prevent="focusInput(packerFormKey(variable))"
                  class="text-base font-bold text-gray-900 cursor-pointer hover:text-blue-700 transition-colors flex-1"
                >
                  {{ variable.name }}
                </label>

                <button
                  v-if="variable.description || isList(variable.type)"
                  @click.stop="toggleTooltip(packerFormKey(variable))"
                  class="text-gray-400 hover:text-blue-600 transition-colors focus:outline-none"
                  :class="activeTooltip === packerFormKey(variable) ? 'text-blue-600' : ''"
                  :title="t('deployment.variables.showInfo')"
                >
                  <Info :size="16" />
                </button>
              </div>

              <div
                v-if="variable.markerError"
                class="mb-3 bg-amber-50 p-3 rounded-lg border border-amber-300 text-xs text-amber-800"
              >
                <p class="font-semibold mb-1 flex items-center gap-1.5">
                  <AlertTriangle :size="14" class="shrink-0" />
                  {{ t('deployment.variables.markerErrorTitle') }}
                </p>
                <p>{{ variable.markerError.message }}</p>
                <p v-if="variable.markerError.location" class="mt-1 font-mono text-amber-700">
                  {{ variable.markerError.location }}
                </p>
              </div>

              <div v-if="activeTooltip === packerFormKey(variable)" class="mb-3 bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm text-gray-700">
                <p v-if="variable.description" class="mb-2">{{ variable.description }}</p>
                <div v-if="isList(variable.type)" class="flex gap-2 items-start text-xs text-blue-700">
                  <Info :size="12" class="mt-0.5 shrink-0" />
                  <span>{{ t('deployment.variables.commaSeparated') }}</span>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2 mb-3">
                <span class="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                  {{ variable.type }}
                </span>
                <span v-if="variable.required" class="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200">
                  {{ t('deployment.variables.required') }}
                </span>
                <ScopeBadge :scope="effectiveScope(variable)" />
              </div>

              <div
                v-if="isScoped(variable)"
                class="mb-3 text-xs text-purple-800 bg-purple-50 border border-purple-200 rounded px-3 py-2"
              >
                <p class="font-semibold mb-0.5">
                  {{ effectiveScope(variable) === 'team' ? t('deployment.variables.scopeTitleTeam') : t('deployment.variables.scopeTitleUser') }}
                </p>
                <p v-html="effectiveScope(variable) === 'team' ? t('deployment.variables.scopeDescTeam') : t('deployment.variables.scopeDescUser')"></p>
              </div>

              <div v-if="isFileVar(variable)" class="space-y-3">
                <FileDropZone
                  v-if="(variable.osScope || 'all') === 'all'"
                  :model-value="getFileSlot(variable.name, 'all')"
                  @update:modelValue="(v) => setFileSlot(variable.name, 'all', v)"
                  :label="variable.name"
                  :accept="fileAcceptFor(variable)"
                />
                <template v-else-if="variable.osScope === 'team'">
                  <FileDropZone
                    v-for="team in wizardTeams"
                    :key="`${variable.name}::${team.name}`"
                    :model-value="getFileSlot(variable.name, team.name)"
                    @update:modelValue="(v) => setFileSlot(variable.name, team.name, v)"
                    :label="team.name"
                    :accept="fileAcceptFor(variable)"
                  />
                  <div v-if="wizardTeams.length === 0" class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    {{ t('deployment.variables.noTeamsConfigured') }}
                  </div>
                </template>
                <template v-else-if="variable.osScope === 'user'">
                  <div
                    v-for="team in wizardTeams"
                    :key="`${variable.name}::${team.name}`"
                    class="border-l-2 border-gray-200 pl-3 space-y-2"
                  >
                    <div class="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      {{ team.name }}
                    </div>
                    <FileDropZone
                      v-for="member in team.members"
                      :key="`${variable.name}::${team.name}::${member.userId}`"
                      :model-value="getFileSlot(variable.name, userSlotKey(team.name, member.username))"
                      @update:modelValue="(v) => setFileSlot(variable.name, userSlotKey(team.name, member.username), v)"
                      :label="member.username"
                      :accept="fileAcceptFor(variable)"
                    />
                    <div v-if="team.members.length === 0" class="text-xs text-gray-500 italic">
                      {{ t('deployment.variables.noMembers') }}
                    </div>
                  </div>
                  <div v-if="wizardTeams.length === 0" class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    {{ t('deployment.variables.noTeamsConfigured') }}
                  </div>
                </template>
              </div>

              <template v-else>
                <VariableInput
                  v-if="!isScoped(variable)"
                  :variable="variable"
                  :model-value="formValues[packerFormKey(variable)]"
                  @update:modelValue="(v) => (formValues[packerFormKey(variable)] = v)"
                  :filter-network-id="variable.osType === 'subnet' ? findNetworkValueForSubnet(variable) : null"
                  accent="blue"
                  :input-id="packerFormKey(variable)"
                />
                <div v-else class="space-y-3">
                  <div
                    v-if="slotKeysFor(variable).length === 0 && effectiveScope(variable) === 'team'"
                    class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2"
                  >
                    {{ t('deployment.variables.noTeamsConfigured') }}
                  </div>
                  <template v-if="effectiveScope(variable) === 'user'">
                    <div v-if="wizardTeams.length === 0" class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      {{ t('deployment.variables.noTeamsConfigured') }}
                    </div>
                    <div
                      v-for="team in wizardTeams"
                      :key="`${variable.name}::team::${team.name}`"
                      class="border-l-2 border-gray-200 pl-3 space-y-2"
                    >
                      <div class="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        {{ team.name }}
                      </div>
                      <div
                        v-for="member in team.members"
                        :key="`${variable.name}::${team.name}::${member.userId}`"
                        class="flex flex-col gap-1"
                      >
                        <label
                          :for="`${packerFormKey(variable)}__${userSlotKey(team.name, member.username)}`"
                          class="text-xs font-semibold text-gray-600"
                        >
                          {{ member.username }}
                        </label>
                        <VariableInput
                          :variable="variable"
                          :model-value="getScopedValue(packerFormKey(variable), userSlotKey(team.name, member.username))"
                          @update:modelValue="(v) => setScopedValue(packerFormKey(variable), userSlotKey(team.name, member.username), v)"
                          :filter-network-id="variable.osType === 'subnet' ? findNetworkValueForSubnet(variable) : null"
                          accent="blue"
                          :input-id="`${packerFormKey(variable)}__${userSlotKey(team.name, member.username)}`"
                        />
                      </div>
                      <div v-if="team.members.length === 0" class="text-xs text-gray-500 italic">
                        {{ t('deployment.variables.noMembers') }}
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    <div
                      v-for="slotKey in slotKeysFor(variable)"
                      :key="`${variable.name}::${slotKey}`"
                      class="flex flex-col gap-1"
                    >
                      <label
                        :for="`${packerFormKey(variable)}__${slotKey}`"
                        class="text-xs font-semibold text-gray-600"
                      >
                        {{ formatSlotLabel(variable, slotKey) }}
                      </label>
                      <VariableInput
                        :variable="variable"
                        :model-value="getScopedValue(packerFormKey(variable), slotKey)"
                        @update:modelValue="(v) => setScopedValue(packerFormKey(variable), slotKey, v)"
                        :filter-network-id="variable.osType === 'subnet' ? findNetworkValueForSubnet(variable) : null"
                        accent="blue"
                        :input-id="`${packerFormKey(variable)}__${slotKey}`"
                      />
                    </div>
                  </template>
                </div>
              </template>
            </div>
            </template>
          </div>
        </div>

        <div class="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200 overflow-hidden">
          <div class="bg-purple-600 text-white px-6 py-4 flex items-center gap-3">
            <Layers :size="24" />
            <div>
              <h2 class="text-xl font-bold">{{ t('deployment.summary.terraformVars') }}</h2>
              <p class="text-xs text-purple-100 mt-0.5">{{ t('deployment.variables.terraformDesc') }}</p>
            </div>
          </div>
          
          <div class="p-6 space-y-6 max-h-[600px] overflow-y-auto">
            <div v-if="terraformVariables.length === 0" class="text-center py-8 text-purple-600 italic">
              {{ t('deployment.summary.noTerraformVars') }}
            </div>
            
            <div v-for="variable in terraformVariables" :key="variable.name" class="bg-white rounded-lg p-4 border border-purple-200 shadow-sm">
              <div class="flex items-start justify-between gap-2 mb-3">
                <label
                  :for="variable.name"
                  @click.prevent="focusInput(variable.name)"
                  class="text-base font-bold text-gray-900 cursor-pointer hover:text-purple-700 transition-colors flex-1"
                >
                  {{ variable.name }}
                </label>

                <button
                  v-if="variable.description || isList(variable.type)"
                  @click.stop="toggleTooltip(variable.name)"
                  class="text-gray-400 hover:text-purple-600 transition-colors focus:outline-none"
                  :class="activeTooltip === variable.name ? 'text-purple-600' : ''"
                  :title="t('deployment.variables.showInfo')"
                >
                  <Info :size="16" />
                </button>
              </div>

              <div
                v-if="variable.markerError"
                class="mb-3 bg-amber-50 p-3 rounded-lg border border-amber-300 text-xs text-amber-800"
              >
                <p class="font-semibold mb-1 flex items-center gap-1.5">
                  <AlertTriangle :size="14" class="shrink-0" />
                  {{ t('deployment.variables.markerErrorTitle') }}
                </p>
                <p>{{ variable.markerError.message }}</p>
                <p v-if="variable.markerError.location" class="mt-1 font-mono text-amber-700">
                  {{ variable.markerError.location }}
                </p>
              </div>

              <div v-if="activeTooltip === variable.name" class="mb-3 bg-purple-50 p-3 rounded-lg border border-purple-100 text-sm text-gray-700">
                <p v-if="variable.description" class="mb-2">{{ variable.description }}</p>
                <div v-if="isList(variable.type)" class="flex gap-2 items-start text-xs text-purple-700">
                  <Info :size="12" class="mt-0.5 shrink-0" />
                  <span>{{ t('deployment.variables.commaSeparated') }}</span>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2 mb-3">
                <span class="text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                  {{ variable.type }}
                </span>
                <span v-if="variable.required" class="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200">
                  {{ t('deployment.variables.required') }}
                </span>
                <ScopeBadge :scope="effectiveScope(variable)" />
              </div>

              <div
                v-if="isScoped(variable)"
                class="mb-3 text-xs text-purple-800 bg-purple-50 border border-purple-200 rounded px-3 py-2"
              >
                <p class="font-semibold mb-0.5">
                  {{ effectiveScope(variable) === 'team' ? t('deployment.variables.scopeTitleTeam') : t('deployment.variables.scopeTitleUser') }}
                </p>
                <p v-html="effectiveScope(variable) === 'team' ? t('deployment.variables.scopeDescTeam') : t('deployment.variables.scopeDescUser')"></p>
              </div>

              <div v-if="isFileVar(variable)" class="space-y-3">
                <FileDropZone
                  v-if="(variable.osScope || 'all') === 'all'"
                  :model-value="getFileSlot(variable.name, 'all')"
                  @update:modelValue="(v) => setFileSlot(variable.name, 'all', v)"
                  :label="variable.name"
                  :accept="fileAcceptFor(variable)"
                />
                <template v-else-if="variable.osScope === 'team'">
                  <FileDropZone
                    v-for="team in wizardTeams"
                    :key="`${variable.name}::${team.name}`"
                    :model-value="getFileSlot(variable.name, team.name)"
                    @update:modelValue="(v) => setFileSlot(variable.name, team.name, v)"
                    :label="team.name"
                    :accept="fileAcceptFor(variable)"
                  />
                  <div v-if="wizardTeams.length === 0" class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    {{ t('deployment.variables.noTeamsConfigured') }}
                  </div>
                </template>
                <template v-else-if="variable.osScope === 'user'">
                  <div
                    v-for="team in wizardTeams"
                    :key="`${variable.name}::${team.name}`"
                    class="border-l-2 border-gray-200 pl-3 space-y-2"
                  >
                    <div class="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      {{ team.name }}
                    </div>
                    <FileDropZone
                      v-for="member in team.members"
                      :key="`${variable.name}::${team.name}::${member.userId}`"
                      :model-value="getFileSlot(variable.name, userSlotKey(team.name, member.username))"
                      @update:modelValue="(v) => setFileSlot(variable.name, userSlotKey(team.name, member.username), v)"
                      :label="member.username"
                      :accept="fileAcceptFor(variable)"
                    />
                    <div v-if="team.members.length === 0" class="text-xs text-gray-500 italic">
                      {{ t('deployment.variables.noMembers') }}
                    </div>
                  </div>
                  <div v-if="wizardTeams.length === 0" class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    {{ t('deployment.variables.noTeamsConfigured') }}
                  </div>
                </template>
              </div>

              <template v-else>
                <VariableInput
                  v-if="!isScoped(variable)"
                  :variable="variable"
                  :model-value="formValues[variable.name]"
                  @update:modelValue="(v) => (formValues[variable.name] = v)"
                  :filter-network-id="variable.osType === 'subnet' ? findNetworkValueForSubnet(variable) : null"
                  accent="purple"
                  :input-id="variable.name"
                />
                <div v-else class="space-y-3">
                  <div
                    v-if="slotKeysFor(variable).length === 0 && effectiveScope(variable) === 'team'"
                    class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2"
                  >
                    {{ t('deployment.variables.noTeamsConfigured') }}
                  </div>
                  <template v-if="effectiveScope(variable) === 'user'">
                    <div v-if="wizardTeams.length === 0" class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      {{ t('deployment.variables.noTeamsConfigured') }}
                    </div>
                    <div
                      v-for="team in wizardTeams"
                      :key="`${variable.name}::team::${team.name}`"
                      class="border-l-2 border-gray-200 pl-3 space-y-2"
                    >
                      <div class="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        {{ team.name }}
                      </div>
                      <div
                        v-for="member in team.members"
                        :key="`${variable.name}::${team.name}::${member.userId}`"
                        class="flex flex-col gap-1"
                      >
                        <label
                          :for="`${variable.name}__${userSlotKey(team.name, member.username)}`"
                          class="text-xs font-semibold text-gray-600"
                        >
                          {{ member.username }}
                        </label>
                        <VariableInput
                          :variable="variable"
                          :model-value="getScopedValue(variable.name, userSlotKey(team.name, member.username))"
                          @update:modelValue="(v) => setScopedValue(variable.name, userSlotKey(team.name, member.username), v)"
                          :filter-network-id="variable.osType === 'subnet' ? findNetworkValueForSubnet(variable) : null"
                          accent="purple"
                          :input-id="`${variable.name}__${userSlotKey(team.name, member.username)}`"
                        />
                      </div>
                      <div v-if="team.members.length === 0" class="text-xs text-gray-500 italic">
                        {{ t('deployment.variables.noMembers') }}
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    <div
                      v-for="slotKey in slotKeysFor(variable)"
                      :key="`${variable.name}::${slotKey}`"
                      class="flex flex-col gap-1"
                    >
                      <label
                        :for="`${variable.name}__${slotKey}`"
                        class="text-xs font-semibold text-gray-600"
                      >
                        {{ formatSlotLabel(variable, slotKey) }}
                      </label>
                      <VariableInput
                        :variable="variable"
                        :model-value="getScopedValue(variable.name, slotKey)"
                        @update:modelValue="(v) => setScopedValue(variable.name, slotKey, v)"
                        :filter-network-id="variable.osType === 'subnet' ? findNetworkValueForSubnet(variable) : null"
                        accent="purple"
                        :input-id="`${variable.name}__${slotKey}`"
                      />
                    </div>
                  </template>
                </div>
              </template>
            </div>
          </div>
        </div>

      </div>
    </div>

    <div class="flex justify-between items-center mt-12 pt-6 border-t border-gray-100">
      <button
        @click="handleBack"
        class="flex items-center gap-2 px-6 py-2.5 rounded-full text-gray-500 font-semibold hover:text-gray-900 hover:bg-gray-100 transition-colors"
      >
        <ArrowLeft :size="18" />
        {{ t('deployment.actions.back') }}
      </button>

      <div v-if="!canSubmit && !isLoading && variables.length > 0" class="flex-1 mx-6 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
        <p class="font-semibold mb-0.5">{{ t('deployment.variables.missingRequiredTitle') }}</p>
        <ul class="list-disc pl-5">
          <li v-for="m in missingRequired" :key="m">{{ m }}</li>
        </ul>
      </div>

      <button
        @click="handleNext"
        :disabled="!canSubmit"
        :class="[
          'flex items-center gap-2 px-8 py-2.5 rounded-full font-bold transition-colors shadow-lg',
          canSubmit
            ? 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-emerald-700/20'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none',
        ]"
      >
        {{ t('deployment.actions.next') }}
        <ArrowRight :size="18" />
      </button>
    </div>

  </div>
</template>