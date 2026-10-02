<script setup lang="ts">
import { computed } from 'vue'
import { appPresentation } from '@/config/app-catalog'
const props = defineProps<{ name: string; image?: string | null }>()
const presentation = computed(() => appPresentation(props.name))
</script>

<template>
  <span class="app-logo" :data-tone="image ? undefined : presentation.tone">
    <img v-if="image || presentation.fullColor" :src="image || presentation.logo" :alt="name" />
    <span v-else-if="presentation.logo" class="app-logo-mask" :style="{ maskImage: `url(${presentation.logo})` }" role="img" :aria-label="name" />
    <component v-else :is="presentation.icon" :size="30" :stroke-width="1.5" aria-hidden="true" />
  </span>
</template>

<style scoped>
.app-logo { display: grid; place-items: center; width: 54px; height: 54px; flex-shrink: 0; border-radius: 9px; color: rgb(var(--color-primary)); background: rgb(var(--color-primary) / .07); overflow: hidden; }
.app-logo img { width: 100%; height: 100%; object-fit: contain; }
.app-logo-mask { width: 70%; height: 70%; background: currentColor; mask-position: center; mask-repeat: no-repeat; mask-size: contain; }
.app-logo[data-tone='orange'] { color: white; background: rgb(var(--color-logo-orange)); }
.app-logo[data-tone='cloud'] { color: white; background: rgb(var(--color-logo-cloud)); }
.app-logo[data-tone='r'] { color: white; background: rgb(var(--color-logo-r)); border-radius: 50%; }
.app-logo[data-tone='postgres'] { color: rgb(var(--color-logo-postgres)); background: transparent; }
.app-logo[data-tone='postgres'] .app-logo-mask { width: 100%; height: 100%; }
.app-logo[data-tone='code'] { background: rgb(var(--color-logo-cloud) / .1); padding: 6px; }
</style>
