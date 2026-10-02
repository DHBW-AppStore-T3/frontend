<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle, AlertCircle, Lock } from 'lucide-vue-next'

type Variant = 'warning' | 'error' | 'lock'

const props = withDefaults(defineProps<{
  variant?: Variant
  title?: string
  message?: string
  cta?: string
  ctaTo?: string
  next?: string
}>(), {
  variant: 'warning',
})

const styles = computed(() => {
  switch (props.variant) {
    case 'error':
      return {
        wrapper: 'bg-dangerTint border-danger/30 text-red-900',
        iconBox: 'bg-dangerTint text-danger',
        title: 'text-red-900',
        message: 'text-red-800',
        cta: 'bg-red-600 hover:bg-red-700 text-white',
        icon: AlertCircle,
      }
    case 'lock':
      return {
        wrapper: 'bg-infoTint border-info/30 text-blue-900',
        iconBox: 'bg-infoTint text-info',
        title: 'text-blue-900',
        message: 'text-blue-800',
        cta: 'bg-blue-600 hover:bg-blue-700 text-white',
        icon: Lock,
      }
    case 'warning':
    default:
      return {
        wrapper: 'bg-amber-50 border-amber-200 text-amber-900',
        iconBox: 'bg-amber-100 text-amber-600',
        title: 'text-amber-900',
        message: 'text-amber-800',
        cta: 'bg-amber-600 hover:bg-amber-700 text-white',
        icon: AlertTriangle,
      }
  }
})

const ctaLocation = computed(() => {
  if (!props.ctaTo) return null
  if (props.next) {
    return { path: props.ctaTo, query: { next: props.next } }
  }
  return props.ctaTo
})
</script>

<template>
  <div
    class="rounded-xl border p-4 flex items-start gap-4"
    :class="styles.wrapper"
  >
    <div
      class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
      :class="styles.iconBox"
    >
      <component :is="styles.icon" :size="20" />
    </div>
    <div class="flex-1 min-w-0">
      <p v-if="title" class="font-semibold" :class="styles.title">{{ title }}</p>
      <p v-if="message" class="text-sm mt-0.5" :class="styles.message">{{ message }}</p>
    </div>
    <router-link
      v-if="cta && ctaLocation"
      :to="ctaLocation"
      class="shrink-0 px-4 py-2 rounded-md text-sm font-semibold transition-colors"
      :class="styles.cta"
    >
      {{ cta }}
    </router-link>
  </div>
</template>
