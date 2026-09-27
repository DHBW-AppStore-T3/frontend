<script setup lang="ts">
/**
 * MarkdownEditor — textarea + toolbar + preview tab.
 *
 * Lightweight by design: no WYSIWYG. The toolbar wraps the current
 * selection in markdown syntax (e.g. select "foo" → click B → ``**foo**``).
 * Cursor lands inside the wrap when the selection was empty, so the user
 * can keep typing without manually nudging.
 *
 * Auto-resize behaviour is inlined from the previous AddAppsView
 * implementation so we don't regress that view's look.
 */
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Bold, Italic, Heading1, Heading2, List, Link as LinkIcon,
  Code as CodeIcon, Code2, Eye, Pencil,
} from 'lucide-vue-next'
import MarkdownRenderer from './MarkdownRenderer.vue'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  /** Minimum textarea height in px. Auto-resize grows past this. */
  minHeightPx?: number
  /** Hard cap on auto-resize. Scroll kicks in past this. */
  maxHeightPx?: number
}>(), {
  placeholder: '',
  minHeightPx: 96,
  maxHeightPx: 320,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const { t } = useI18n()

const mode = ref<'edit' | 'preview'>('edit')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const local = computed({
  get: () => props.modelValue ?? '',
  set: (v: string) => emit('update:modelValue', v),
})

// ----------------------------------------------------------------
// Auto-resize
// ----------------------------------------------------------------
const autoResize = () => {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(Math.max(el.scrollHeight, props.minHeightPx), props.maxHeightPx)}px`
}

// Re-size after the parent updates the model (e.g. clearing the form
// from the outside) and on mount once the textarea is in the DOM.
watch(() => props.modelValue, () => nextTick(autoResize))
onMounted(autoResize)

// ----------------------------------------------------------------
// Toolbar actions
// ----------------------------------------------------------------
type WrapAction = { prefix: string; suffix: string; placeholder: string }
type LinePrefixAction = { linePrefix: string; placeholder: string }

const setSelection = (start: number, end: number) => {
  const el = textareaRef.value
  if (!el) return
  // Defer to after the v-model round-trip so the new value is in the
  // textarea before we touch selectionStart/End.
  nextTick(() => {
    el.focus()
    el.setSelectionRange(start, end)
    autoResize()
  })
}

const applyWrap = ({ prefix, suffix, placeholder }: WrapAction) => {
  const el = textareaRef.value
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const value = local.value
  const selected = value.slice(start, end) || placeholder
  const next = value.slice(0, start) + prefix + selected + suffix + value.slice(end)
  local.value = next
  const cursorStart = start + prefix.length
  const cursorEnd = cursorStart + selected.length
  setSelection(cursorStart, cursorEnd)
}

const applyLinePrefix = ({ linePrefix, placeholder }: LinePrefixAction) => {
  const el = textareaRef.value
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const value = local.value
  // Expand selection to full lines so the prefix applies cleanly to a
  // multi-line block (e.g. turning three pasted lines into a list).
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const lineEnd = end === start ? end : (value.indexOf('\n', end - 1) === -1 ? value.length : value.indexOf('\n', end - 1))
  const block = value.slice(lineStart, lineEnd === -1 ? value.length : lineEnd) || placeholder
  const prefixed = block.split('\n').map(line => `${linePrefix}${line}`).join('\n')
  const next = value.slice(0, lineStart) + prefixed + value.slice(lineEnd === -1 ? value.length : lineEnd)
  local.value = next
  setSelection(lineStart, lineStart + prefixed.length)
}

const applyLink = () => {
  const el = textareaRef.value
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const value = local.value
  const selected = value.slice(start, end) || t('markdownEditor.linkText')
  // ``url`` placeholder gets highlighted so the user can immediately
  // overwrite it; that's what most editors do.
  const insertion = `[${selected}](url)`
  const next = value.slice(0, start) + insertion + value.slice(end)
  local.value = next
  const urlStart = start + selected.length + 3 // after "[selected]("
  const urlEnd = urlStart + 3 // "url"
  setSelection(urlStart, urlEnd)
}

const applyCodeBlock = () => {
  const el = textareaRef.value
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const value = local.value
  const selected = value.slice(start, end) || t('markdownEditor.codePlaceholder')
  // Always wrap with newlines so we don't accidentally inline-merge with
  // the surrounding paragraph.
  const insertion = `\n\`\`\`\n${selected}\n\`\`\`\n`
  const next = value.slice(0, start) + insertion + value.slice(end)
  local.value = next
  const codeStart = start + 5 // skip ``\n```\n``
  const codeEnd = codeStart + selected.length
  setSelection(codeStart, codeEnd)
}

// ----------------------------------------------------------------
// Keyboard shortcuts (Ctrl/Cmd-B, Ctrl/Cmd-I)
// ----------------------------------------------------------------
const onKeydown = (e: KeyboardEvent) => {
  const meta = e.ctrlKey || e.metaKey
  if (!meta) return
  if (e.key === 'b' || e.key === 'B') {
    e.preventDefault()
    applyWrap({ prefix: '**', suffix: '**', placeholder: t('markdownEditor.boldPlaceholder') })
  } else if (e.key === 'i' || e.key === 'I') {
    e.preventDefault()
    applyWrap({ prefix: '_', suffix: '_', placeholder: t('markdownEditor.italicPlaceholder') })
  }
}

// ----------------------------------------------------------------
// Toolbar button declarations
// ----------------------------------------------------------------
const onBold = () =>
  applyWrap({ prefix: '**', suffix: '**', placeholder: t('markdownEditor.boldPlaceholder') })
const onItalic = () =>
  applyWrap({ prefix: '_', suffix: '_', placeholder: t('markdownEditor.italicPlaceholder') })
const onInlineCode = () =>
  applyWrap({ prefix: '`', suffix: '`', placeholder: t('markdownEditor.codePlaceholder') })
const onH1 = () =>
  applyLinePrefix({ linePrefix: '# ', placeholder: t('markdownEditor.headingPlaceholder') })
const onH2 = () =>
  applyLinePrefix({ linePrefix: '## ', placeholder: t('markdownEditor.headingPlaceholder') })
const onList = () =>
  applyLinePrefix({ linePrefix: '- ', placeholder: t('markdownEditor.listPlaceholder') })
</script>

<template>
  <div class="w-full rounded-lg border border-borderSubtle bg-white shadow-sm overflow-hidden">
    <!-- Tab bar -->
    <div class="flex items-center gap-0.5 border-b border-borderSubtle bg-surfaceMuted px-2">
      <button
        type="button"
        @click="mode = 'edit'"
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px"
        :class="mode === 'edit'
          ? 'border-primary text-primary'
          : 'border-transparent text-textMuted hover:text-textHeading'"
      >
        <Pencil :size="12" />
        {{ t('markdownEditor.tabEdit') }}
      </button>
      <button
        type="button"
        @click="mode = 'preview'"
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px"
        :class="mode === 'preview'
          ? 'border-primary text-primary'
          : 'border-transparent text-textMuted hover:text-textHeading'"
      >
        <Eye :size="12" />
        {{ t('markdownEditor.tabPreview') }}
      </button>

      <!-- Toolbar (edit mode only) -->
      <div
        v-if="mode === 'edit'"
        class="ml-auto flex items-center gap-0.5 py-1"
      >
        <button type="button" @click="onBold" :title="t('markdownEditor.toolbar.bold')"
                class="p-1 rounded hover:bg-gray-200 text-textMuted">
          <Bold :size="14" />
        </button>
        <button type="button" @click="onItalic" :title="t('markdownEditor.toolbar.italic')"
                class="p-1 rounded hover:bg-gray-200 text-textMuted">
          <Italic :size="14" />
        </button>
        <span class="mx-1 h-4 w-px bg-gray-300"></span>
        <button type="button" @click="onH1" :title="t('markdownEditor.toolbar.h1')"
                class="p-1 rounded hover:bg-gray-200 text-textMuted">
          <Heading1 :size="14" />
        </button>
        <button type="button" @click="onH2" :title="t('markdownEditor.toolbar.h2')"
                class="p-1 rounded hover:bg-gray-200 text-textMuted">
          <Heading2 :size="14" />
        </button>
        <span class="mx-1 h-4 w-px bg-gray-300"></span>
        <button type="button" @click="onList" :title="t('markdownEditor.toolbar.list')"
                class="p-1 rounded hover:bg-gray-200 text-textMuted">
          <List :size="14" />
        </button>
        <button type="button" @click="applyLink" :title="t('markdownEditor.toolbar.link')"
                class="p-1 rounded hover:bg-gray-200 text-textMuted">
          <LinkIcon :size="14" />
        </button>
        <button type="button" @click="onInlineCode" :title="t('markdownEditor.toolbar.code')"
                class="p-1 rounded hover:bg-gray-200 text-textMuted">
          <CodeIcon :size="14" />
        </button>
        <button type="button" @click="applyCodeBlock" :title="t('markdownEditor.toolbar.codeblock')"
                class="p-1 rounded hover:bg-gray-200 text-textMuted">
          <Code2 :size="14" />
        </button>
      </div>
    </div>

    <!-- Edit / Preview body -->
    <div class="p-2">
      <textarea
        v-show="mode === 'edit'"
        ref="textareaRef"
        v-model="local"
        :placeholder="placeholder"
        @input="autoResize"
        @keydown="onKeydown"
        :style="{ minHeight: `${minHeightPx}px`, maxHeight: `${maxHeightPx}px` }"
        class="block w-full resize-none rounded-md border border-transparent bg-white px-2 py-1.5 text-sm text-textMuted focus:ring-2 focus:ring-primary focus:border-primary outline-none font-mono overflow-y-auto"
      />
      <div
        v-show="mode === 'preview'"
        class="px-2 py-1.5 text-sm"
        :style="{ minHeight: `${minHeightPx}px` }"
      >
        <MarkdownRenderer v-if="local.trim()" :source="local" variant="full" />
        <p v-else class="text-textFaint italic">{{ t('markdownEditor.emptyPreview') }}</p>
      </div>
    </div>
  </div>
</template>
