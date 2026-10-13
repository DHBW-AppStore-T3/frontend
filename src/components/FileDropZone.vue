<script lang="ts" setup>
/**
 * FileDropZone — drop-or-click upload widget for one file.
 *
 * Used by the deployment wizard to gather files for
 * ``@openstack:file:<scope>``-marked variables. Callers receive a
 * ready-to-ship ``DeploymentFile`` payload (name, content_b64, size,
 * content_type) via the ``change`` event so they don't have to know
 * how to base64-encode a File themselves.
 *
 * Pattern is lifted from ``AddAppsView.vue``'s logo upload — same
 * drag-drop, same FileReader trick, but generalised so the deploy
 * wizard can render N of these for per-team / per-user scopes.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Upload, FileText, X } from 'lucide-vue-next'
import type { DeploymentFile } from '@/types'
import { formatBytes } from '@/utils/format'

const props = withDefaults(defineProps<{
  /** Optional MIME-filter for the native file picker (e.g. ``"application/pdf"``). */
  accept?: string
  /** Per-file cap in bytes. Mirrors the backend's per-file limit so the
   *  user gets a clean error before the request even leaves the browser. */
  maxBytes?: number
  /** Existing payload — when the wizard is re-entered (back-button) we
   *  re-render the previous selection without forcing a fresh upload. */
  modelValue?: DeploymentFile | null
  /** Label for the empty state, e.g. "Aufgabenstellung" or "Team-1 Datensatz". */
  label?: string
  /** Stops the user from changing the file once set (read-only display). */
  disabled?: boolean
}>(), {
  accept: '*',
  maxBytes: 2 * 1024 * 1024,
  modelValue: null,
  label: '',
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: DeploymentFile | null): void
  (e: 'change', value: DeploymentFile | null): void
  (e: 'error', message: string): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const { t } = useI18n()
// Local error string so the component can render its own validation
// feedback inline; the parent gets the same message via the ``error``
// event in case it wants to toast it.
const localError = ref<string>('')

const hasValue = computed(() => !!props.modelValue)

/**
 * Read a File into a base64 string (without the ``data:...,`` prefix
 * that ``readAsDataURL`` adds). The backend stores ``content_b64`` as
 * the bare base64 payload so cloud-init's ``encoding: b64`` can decode
 * it directly without the wrapper.
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const out = typeof reader.result === 'string' ? reader.result : ''
      // ``result`` is a data URL like ``data:application/pdf;base64,JVB...``.
      // Strip the prefix so we ship the raw base64 — the backend
      // expects ``validate=True``-friendly bytes (no wrapper).
      const idx = out.indexOf('base64,')
      if (idx < 0) {
        reject(new Error('Failed to encode file'))
        return
      }
      resolve(out.slice(idx + 'base64,'.length))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

const processFile = async (file: File) => {
  if (props.disabled) return
  localError.value = ''
  if (file.size > props.maxBytes) {
    const msg = t('fileDropZone.tooLarge', { mb: Math.round(props.maxBytes / 1024 / 1024) })
    localError.value = msg
    emit('error', msg)
    return
  }
  try {
    const b64 = await fileToBase64(file)
    const payload: DeploymentFile = {
      name: file.name,
      content_b64: b64,
      size: file.size,
      content_type: file.type || 'application/octet-stream',
    }
    emit('update:modelValue', payload)
    emit('change', payload)
  } catch (e: any) {
    const msg = e?.message || t('fileDropZone.readError')
    localError.value = msg
    emit('error', msg)
  }
}

const triggerInput = () => {
  if (props.disabled) return
  fileInputRef.value?.click()
}

const onFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) processFile(file)
  // Allow re-selecting the same file later — without this the change
  // event wouldn't fire on identical re-pick.
  if (target) target.value = ''
}

const onDrop = (event: DragEvent) => {
  isDragging.value = false
  if (props.disabled) return
  const file = event.dataTransfer?.files?.[0]
  if (file) processFile(file)
}

const clearFile = () => {
  if (props.disabled) return
  emit('update:modelValue', null)
  emit('change', null)
}
</script>

<template>
  <div class="space-y-1">
    <!-- Empty state: drop zone + click to pick. -->
    <div
      v-if="!hasValue"
      class="border-2 border-dashed rounded-md px-4 py-3 cursor-pointer transition-colors flex items-center gap-3"
      :class="[
        isDragging ? 'border-green-500 bg-successTint' : 'border-borderSubtle hover:border-textFaint',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ]"
      @dragover.prevent="!disabled && (isDragging = true)"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
      @click="triggerInput"
    >
      <Upload :size="20" class="text-textMuted shrink-0" />
      <div class="flex-1 min-w-0">
        <div class="text-sm text-textMuted truncate">
          <span v-if="label" class="font-medium">{{ label }}: </span>
          <span class="text-textMuted">{{ t('fileDropZone.pick') }}</span>
        </div>
        <div class="text-xs text-textFaint mt-0.5">
          max. {{ Math.round(maxBytes / 1024 / 1024) }} MB
        </div>
      </div>
      <input
        ref="fileInputRef"
        type="file"
        :accept="accept"
        :disabled="disabled"
        class="hidden"
        @change="onFileChange"
      />
    </div>

    <!-- Filled state: show name + size + remove button. -->
    <div
      v-else
      class="border rounded-md px-4 py-3 bg-surfaceMuted flex items-center gap-3"
    >
      <FileText :size="20" class="text-textMuted shrink-0" />
      <div class="flex-1 min-w-0">
        <div v-if="label" class="text-xs text-textMuted mb-0.5">{{ label }}</div>
        <div class="text-sm font-medium text-textHeading truncate">{{ modelValue!.name }}</div>
        <div class="text-xs text-textMuted">
          {{ formatBytes(modelValue!.size) }}
        </div>
      </div>
      <button
        v-if="!disabled"
        type="button"
        class="p-1 rounded hover:bg-gray-200 text-textMuted hover:text-danger"
        :title="t('fileDropZone.remove')"
        @click.stop="clearFile"
      >
        <X :size="16" />
      </button>
    </div>

    <!-- Inline error if validation rejected the pick. -->
    <div v-if="localError" class="text-xs text-danger">{{ localError }}</div>
  </div>
</template>
