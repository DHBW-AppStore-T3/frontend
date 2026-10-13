<!-- src/components/ui/Modal.vue -->
<script setup lang="ts">
import { toRef } from 'vue'
import { useOverlay } from '@/composables/useOverlay'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits(['close'])

const { containerRef } = useOverlay({
  show: toRef(props, 'show'),
  onClose: () => emit('close'),
})
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black/10 flex items-center justify-center z-50 p-4"
    @click.self="$emit('close')"
  >
    <div
      :ref="(el) => (containerRef = el as HTMLElement | null)"
      class="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] animate-fade-in flex flex-col max-h-[90vh]"
      @click.stop
    >
      <!-- Header -->
      <div class="flex justify-between items-center px-6 py-5 border-b border-gray-100">
        <div class="text-xl font-semibold text-gray-900 leading-tight pr-4">
          <!--
            Two slot names accepted:
              * ``#header`` — used by CoursesView, CourseDetailView.
              * ``#title``  — alias used by DeploymentDetailView, AppsDetailView.
            Either slot wins; both empty falls back to "Modal".
          -->
          <slot name="header">
            <slot name="title">Modal</slot>
          </slot>
        </div>
        <button
          @click="$emit('close')"
          class="p-2 -mr-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          aria-label="Close"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="px-6 py-5 overflow-y-auto flex-grow">
        <slot name="body">
          <slot></slot>
        </slot>
      </div>

      <!-- Footer -->
      <div
        v-if="$slots.footer"
        class="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl"
      >
        <slot name="footer"></slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fade-in {
  from { 
    opacity: 0; 
    transform: scale(0.95); 
  }
  to { 
    opacity: 1; 
    transform: scale(1); 
  }
}

.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}
</style>
