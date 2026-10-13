<script setup lang="ts">
/**
 * MarkdownRenderer — sanitised markdown → HTML output.
 *
 * Two visual variants:
 *  - ``full``    — Tailwind's ``prose`` styling, used on the detail page
 *                  where the description owns its own column.
 *  - ``compact`` — collapses headings to ``<strong>`` and code blocks to
 *                  inline code, used inside app cards / inline rows where
 *                  a giant H1 would explode the layout.
 *
 * ``clamp`` limits the content to N lines via inline-style (not a dynamic
 * Tailwind class — JIT can't detect `line-clamp-${n}` at build time).
 *
 * ``expandable`` shows a "Mehr anzeigen" toggle below the content when the
 * text is actually truncated (``scrollHeight > clientHeight``). Only kicks
 * in when ``clamp`` > 0.
 *
 * The HTML is run through DOMPurify before it hits ``v-html``, so user
 * markdown like ``<img src=x onerror=alert(1)>`` is neutralised.
 */
import { computed, ref, onMounted, watch, nextTick } from 'vue'
import { marked, Renderer } from 'marked'
import DOMPurify from 'dompurify'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  /** Raw markdown source. ``null`` / empty renders nothing. */
  source: string | null | undefined
  /** ``full`` for detail views, ``compact`` for cards & inline. */
  variant?: 'full' | 'compact'
  /** Clamp content to N lines via inline-style. 0 = no clamp. */
  clamp?: number
  /** When true and content is actually truncated, render a toggle to
   *  expand the full text. Only meaningful with ``clamp`` > 0. */
  expandable?: boolean
}>(), {
  variant: 'full',
  clamp: 0,
  expandable: false,
})

const { t } = useI18n()
const expanded = ref(false)
const contentEl = ref<HTMLElement | null>(null)
const isTruncated = ref(false)

const checkTruncation = () => {
  const el = contentEl.value
  if (!el || !props.expandable || !props.clamp) {
    isTruncated.value = false
    return
  }
  // 2px tolerance for sub-pixel rounding across browsers.
  isTruncated.value = el.scrollHeight > el.clientHeight + 2
}

onMounted(() => nextTick(checkTruncation))
watch(() => props.source, () => {
  expanded.value = false
  nextTick(checkTruncation)
})

// ``compact`` neutralises block-level constructs that would blow up an
// inline / card layout: headings render as bold, code blocks as inline
// code. In ``marked`` v18 the heading callback only receives
// ``tokens``/``depth`` (no ``text``), so we read the source off the
// token slice ourselves.
const buildRenderer = (): Renderer => {
  const r = new Renderer()
  if (props.variant === 'compact') {
    r.heading = ({ tokens }) => {
      const text = tokens.map(tok => ('text' in tok ? tok.text : tok.raw)).join('')
      return `<strong>${escapeHtml(text)}</strong> `
    }
    r.code = ({ text }) => `<code>${escapeHtml(text)}</code> `
    r.hr = () => ' · '
  }
  return r
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const html = computed(() => {
  const raw = (props.source ?? '').trim()
  if (!raw) return ''
  const renderer = buildRenderer()
  const parsed = marked.parse(raw, {
    gfm: true,
    breaks: true,
    renderer,
    async: false,
  }) as string
  return DOMPurify.sanitize(parsed, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel'],
  })
})

const contentClass = computed(() => {
  const base: string[] = []
  if (props.variant === 'full') {
    base.push('prose prose-sm md:prose-base max-w-none')
    base.push('prose-a:text-primary prose-a:no-underline hover:prose-a:underline')
    base.push('prose-headings:text-textHeading prose-p:text-textMuted')
    base.push('prose-code:text-textHeading prose-code:bg-surfaceMuted prose-code:px-1 prose-code:rounded')
    base.push('prose-pre:bg-gray-900 prose-pre:text-gray-100')
  } else {
    base.push('text-textMuted leading-relaxed break-words')
    base.push('[&_a]:text-primary [&_a]:underline')
    base.push('[&_code]:bg-surfaceMuted [&_code]:px-1 [&_code]:rounded [&_code]:text-xs')
    base.push('[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5')
    base.push('[&_p]:my-0 [&_strong]:font-semibold')
  }
  return base.join(' ')
})

// Clamp via inline-style — Tailwind JIT can't detect dynamic class names
// like `line-clamp-${n}` and won't generate the CSS for them.
const contentStyle = computed((): Record<string, string> => {
  if (!props.clamp || props.clamp === 0) return {}
  if (props.expandable && expanded.value) return {}
  return {
    display: '-webkit-box',
    WebkitLineClamp: String(props.clamp),
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  }
})

const showToggle = computed(
  () => props.expandable && props.clamp > 0 && (isTruncated.value || expanded.value)
)

const onToggle = () => {
  expanded.value = !expanded.value
  // Re-check after collapse so the toggle survives next render.
  if (!expanded.value) nextTick(checkTruncation)
}
</script>

<template>
  <div v-if="html">
    <div
      ref="contentEl"
      :class="contentClass"
      :style="contentStyle"
      v-html="html"
    />
    <button
      v-if="showToggle"
      type="button"
      class="mt-1 text-xs text-primary hover:underline focus:outline-none"
      @click.stop="onToggle"
    >
      {{ expanded ? t('markdownRenderer.less') : t('markdownRenderer.more') }}
    </button>
  </div>
</template>
