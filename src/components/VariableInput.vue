<script setup lang="ts">
/**
 * Renders the input for ONE variable VALUE. The caller decides whether
 * to render a single instance (``varScope = all``) or one instance per
 * scope slot (``varScope = team|user``) — this component knows nothing
 * about scopes. Its job is:
 *   * pick the right widget for the variable's HCL type
 *   * delegate OpenStack-typed variables to ``OpenStackResourcePicker``
 *   * bind to a single ``modelValue`` (v-model)
 *
 * File-typed variables are NOT handled here — the wizard renders the
 * ``FileDropZone`` block separately because file uploads travel through
 * a different draft channel (``fileUploads``) than scalar inputs.
 *
 * The visual styling (border / focus colors) is sourced from the
 * ``accent`` prop so both wizard sections (Packer = blue, Terraform =
 * purple) stay visually distinct without duplicating five separate
 * input variants per color.
 */
import OpenStackResourcePicker from '@/components/OpenStackResourcePicker.vue'
import { useI18n } from 'vue-i18n'
import type { AppVariable } from '@/types'
import type { OsResourceType } from '@/api/openstack-resources.api'

const { t } = useI18n()

const props = defineProps<{
  variable: AppVariable
  modelValue: any
  /** Which Network's id-mode value to consult when this is a subnet
   *  picker. Caller supplies it because cross-variable lookups live
   *  in the wizard's variables list, not in this component. */
  filterNetworkId?: string | null
  /** Accent color used for borders + focus ring; the wizard's two
   *  sections (Packer / Terraform) drive different palettes. */
  accent?: 'blue' | 'purple'
  /** DOM ``id`` to put on the underlying input. The single-input
   *  variant uses the variable name verbatim for ``<label>``
   *  click-targeting; scope-iterated variants pass a suffixed id so
   *  every slot has its own. */
  inputId?: string
  /** Disable the input — used when a previous wizard step needs to be
   *  completed first (e.g. no teams configured for a team-scoped var). */
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: any): void
}>()

const isBool = (type: string) => ['bool', 'boolean'].includes(type.toLowerCase())
const isNumber = (type: string) => ['number', 'int', 'integer'].includes(type.toLowerCase())
const isList = (type: string) =>
  type.toLowerCase().startsWith('list') ||
  type.toLowerCase().startsWith('set') ||
  type.toLowerCase().startsWith('array')

// The picker takes precedence over type-based inputs, including list(...)
// variables, since it handles multi itself. File variables are rendered by the
// parent and so are excluded here.
const hasOsPicker = (v: AppVariable): boolean =>
  Boolean(v.osType) && v.osType !== 'file'

// Narrow ``AppVariableOsType`` (which includes the pseudo-type ``file``)
// down to ``OsResourceType`` for the picker. ``hasOsPicker`` already
// guarantees ``file`` is filtered out at render time; this is the type
// system's view of the same check.
const pickerOsType = (v: AppVariable): OsResourceType => v.osType as OsResourceType

const update = (value: any) => emit('update:modelValue', value)

// Explicit class maps — Tailwind's JIT can't read class names assembled
// from template-literal segments. Listing both palettes here keeps
// every utility visible to the content scanner.
const borderClass = (() => {
  const a = props.accent || 'blue'
  return a === 'purple'
    ? 'border-purple-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100'
    : 'border-info/30 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
})()
const toggleOn = (() => {
  const a = props.accent || 'blue'
  return a === 'purple' ? 'bg-purple-500' : 'bg-infoTint0'
})()
const toggleFocus = (() => {
  const a = props.accent || 'blue'
  return a === 'purple' ? 'focus:ring-2 focus:ring-purple-500' : 'focus:ring-2 focus:ring-blue-500'
})()
</script>

<template>
  <!-- The OpenStack resource picker takes precedence over all type-based
       renderings, whenever the backend provided an ``osType`` (except
       ``file``, handled by the parent). -->
  <OpenStackResourcePicker
    v-if="hasOsPicker(variable)"
    :os-type="pickerOsType(variable)"
    :os-mode="variable.osMode || 'name'"
    :multi="variable.osMulti || false"
    :filter-network-id="variable.osType === 'subnet' ? (filterNetworkId ?? null) : null"
    :allow-free-text="true"
    :model-value="modelValue"
    @update:modelValue="update"
  />

  <div v-else-if="isBool(variable.type)" class="flex items-center gap-3">
    <button
      type="button"
      :disabled="disabled"
      @click="update(!modelValue)"
      class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      :class="[modelValue ? toggleOn : 'bg-gray-300', toggleFocus]"
    >
      <span
        class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm"
        :class="modelValue ? 'translate-x-6' : 'translate-x-1'"
      />
    </button>
    <span class="text-sm font-medium text-textMuted">
      {{ modelValue ? t('variableInput.on') : t('variableInput.off') }}
    </span>
  </div>

  <input
    v-else-if="isNumber(variable.type)"
    :value="modelValue"
    @input="update(($event.target as HTMLInputElement).valueAsNumber)"
    type="number"
    :id="inputId || variable.name"
    :disabled="disabled"
    class="w-full px-3 py-2 rounded-lg border-2 outline-none transition-all font-medium text-textHeading disabled:bg-surfaceMuted disabled:text-textMuted"
    :class="borderClass"
    placeholder="0"
  />

  <textarea
    v-else-if="isList(variable.type)"
    :value="modelValue"
    @input="update(($event.target as HTMLTextAreaElement).value)"
    :id="inputId || variable.name"
    :disabled="disabled"
    rows="3"
    class="w-full px-3 py-2 rounded-lg border-2 outline-none transition-all font-mono text-sm text-textHeading disabled:bg-surfaceMuted disabled:text-textMuted"
    :class="borderClass"
    :placeholder="t('variableInput.listPlaceholder')"
  />

  <input
    v-else
    :value="modelValue"
    @input="update(($event.target as HTMLInputElement).value)"
    type="text"
    :id="inputId || variable.name"
    :disabled="disabled"
    class="w-full px-3 py-2 rounded-lg border-2 outline-none transition-all font-medium text-textHeading disabled:bg-surfaceMuted disabled:text-textMuted"
    :class="borderClass"
    :placeholder="variable.default ? t('variableInput.defaultPlaceholder', { value: variable.default }) : t('variableInput.enterValue')"
  />
</template>
