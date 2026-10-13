<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'
  bordered?: boolean
}>(), {
  variant: 'neutral',
  bordered: false,
})
</script>

<template>
  <span
    :class="[
      'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium',
      bordered ? 'border' : '',
      variant === 'success'
        ? 'bg-successTint text-success' + (bordered ? ' border-success/30' : '')
        : variant === 'warning'
        ? 'bg-warningTint text-warning' + (bordered ? ' border-warning/30' : '')
        : variant === 'danger'
        ? 'bg-dangerTint text-danger' + (bordered ? ' border-danger/30' : '')
        : variant === 'info'
        ? 'bg-infoTint text-info' + (bordered ? ' border-info/30' : '')
        : variant === 'brand'
        ? 'bg-brandAccentSoft text-brandAccent' + (bordered ? ' border-brandAccent/30' : '')
        : 'bg-surfaceMuted text-textMuted' + (bordered ? ' border-borderSubtle' : '')
    ]"
  >
    <slot />
  </span>
</template>
