<script setup lang="ts">
/**
 * Unified loading / empty / content wrapper for entity-list pages.
 *
 * Three states, one component:
 *   * ``isLoading`` → centered ``Loader2`` spinner + optional text
 *   * ``isEmpty``   → centered icon + empty message + optional action
 *   * otherwise     → the default slot (the entity list itself)
 *
 * Why a component: every main page had its own variant — text-only
 * loading vs. spinner-only vs. spinner-with-text, icon-with-text vs.
 * just-text empty states, different paddings. Centralising the three
 * shapes here gives the whole app a consistent feel without each
 * page rebuilding the same div-with-Tailwind block.
 *
 * Order of precedence: ``isLoading`` wins over ``isEmpty``. That
 * matters because while data is being fetched, ``items.length === 0``
 * is also true, and you don't want to flash the "empty" CTA before
 * the spinner has had a chance to appear.
 */
import { Loader2 } from 'lucide-vue-next'
import type { FunctionalComponent } from 'vue'

defineProps<{
  /** Whether the page is currently fetching its first batch of data.
   *  Wins over ``isEmpty`` — see component docs. */
  isLoading?: boolean
  /** Whether the list of entities is empty AFTER loading has settled.
   *  Callers usually express this as
   *  ``!store.isLoading && store.items.length === 0``. */
  isEmpty?: boolean
  /** Lucide icon component for the empty state (e.g. ``Inbox``,
   *  ``GraduationCap``). Falls back to no icon — the empty message
   *  alone is still rendered. */
  icon?: FunctionalComponent
  /** Visible text for the empty state. */
  emptyMessage?: string
  /** Optional text shown next to the loading spinner. Leave undefined
   *  for pages where the title is self-explanatory and a second
   *  "Lade…" line would just be noise. */
  loadingMessage?: string
}>()
</script>

<template>
  <!-- Loading: spinner + optional one-line label. ``py-12`` matches
       the empty-state vertical air so the page doesn't jump between
       states. -->
  <div v-if="isLoading" class="flex flex-col items-center justify-center py-12 gap-3 text-textMuted">
    <Loader2 :size="32" class="animate-spin text-primary" />
    <p v-if="loadingMessage" class="text-sm">{{ loadingMessage }}</p>
  </div>

  <!-- Empty: icon + message + optional CTA. Icon is muted so the
       primary visual is still the message + action. -->
  <div v-else-if="isEmpty" class="entity-empty flex flex-col items-center justify-center text-center">
    <component
      v-if="icon"
      :is="icon"
      :size="64"
      class="text-textFaint mb-4"
      aria-hidden="true"
    />
    <p v-if="emptyMessage" class="text-textMuted mb-4">{{ emptyMessage }}</p>
    <!--
      Action slot — callers commonly drop a ``<BaseButton>`` here that
      mirrors the page-header create button (so an empty page has a
      visible call-to-action without the user having to find the
      header button). Slot stays optional; many empty states are
      view-only (e.g. approvals, when nothing is pending).
    -->
    <slot name="empty-action" />
  </div>

  <!-- Default slot: the actual list rendering. Callers wrap their
       grid/table here. We don't impose a wrapper — keeps it flexible
       (grid, table, accordion all work). -->
  <slot v-else />
</template>
