<script setup lang="ts">
/**
 * App-wide primary button.
 *
 * Variants:
 *   * ``primary``     — main action / create / submit (brand accent).
 *   * ``secondary``   — confirming secondary action (resume, save in a
 *                       non-destructive context).
 *   * ``outline``     — bordered, low-emphasis action.
 *   * ``text``        — very subtle action (cancel in modals).
 *   * ``destructive`` — destructive action (delete, reject, reset).
 *
 * Disabled: all variants drop the hover effect and switch to
 * ``opacity-50 + cursor-not-allowed``, set centrally here.
 */
withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'outline' | 'text' | 'destructive'
}>(), {
  variant: 'primary',
})
</script>

<template>
  <button
    :class="[
      'inline-flex items-center justify-center gap-2',
      'px-5 py-2.5 rounded-xl font-medium text-sm transition duration-150 shadow-sm',
      'focus:outline-none focus:ring-2 focus:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:!bg-current',
      variant === 'primary'
        ? 'bg-brandAccentSoft text-brandAccent hover:bg-brandAccent hover:text-white focus:ring-brandAccent/60'
        : variant === 'secondary'
        ? 'bg-primarySoft text-gray-800 hover:bg-primary hover:text-white focus:ring-primary/60'
        : variant === 'outline'
        ? 'bg-transparent text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 focus:ring-gray-300 shadow-none'
        : variant === 'text'
        ? 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-300 shadow-none'
        : variant === 'destructive'
        ? 'bg-destructiveSoft text-destructive hover:bg-destructive hover:text-white focus:ring-destructive/60'
        : ''
    ]"
  >
    <slot />
  </button>
</template>
