<script setup lang="ts">
import { toRef } from 'vue'
import { useOverlay } from '@/composables/useOverlay'

const props = withDefaults(defineProps<{ show: boolean; side?: 'left' | 'right' }>(), {
  side: 'left',
})
const emit = defineEmits<{ (e: 'close'): void }>()

const { containerRef } = useOverlay({
  show: toRef(props, 'show'),
  onClose: () => emit('close'),
})
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black/20 z-50"
    @click.self="emit('close')"
  >
    <div
      :ref="(el) => (containerRef = el as HTMLElement | null)"
      data-drawer-panel
      :class="[
        'absolute top-0 h-full w-full max-w-xs bg-white shadow-xl flex flex-col animate-drawer-slide',
        side === 'right' ? 'right-0' : 'left-0',
      ]"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
@keyframes drawer-slide {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

.animate-drawer-slide {
  animation: drawer-slide 0.2s ease-out;
}
</style>
