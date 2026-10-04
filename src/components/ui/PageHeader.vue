<script setup lang="ts">
defineProps<{ title: string; subtitle?: string; eyebrow?: string }>()
</script>

<template>
  <div class="page-header">
    <div class="min-w-0">
      <p v-if="eyebrow" class="page-eyebrow">{{ eyebrow }}</p>
      <h1 class="page-heading">{{ title }}</h1>
      <p v-if="subtitle" class="page-subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="page-actions"><slot name="actions" /></div>
  </div>
</template>
