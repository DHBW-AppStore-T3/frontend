<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check } from 'lucide-vue-next'

const props = defineProps<{
  currentStep: number
}>()

const { t } = useI18n()

// 4 steps: config -> assignment -> variables -> summary
const steps = [
  { step: 1, key: 'deployment.steps.config' },
  { step: 2, key: 'deployment.steps.assignment' },
  { step: 3, key: 'deployment.steps.vars' },
  { step: 4, key: 'deployment.steps.summary' }
]

// Compute the fill width automatically from the number of steps.
const progressWidth = computed(() => {
  const totalSteps = steps.length
  // Guard against division by zero if there were only a single step.
  if (totalSteps <= 1) return '0%'
  
  const percentage = ((props.currentStep - 1) / (totalSteps - 1)) * 100
  // Clamp to 0-100% for safety.
  return `${Math.min(Math.max(percentage, 0), 100)}%`
})

// Helper for text alignment.
const getTextAlignmentClass = (step: number, total: number) => {
  if (step === 1) return 'left-0 origin-left'              // first: left-aligned
  if (step === total) return 'right-0 origin-right'        // last: right-aligned
  return 'left-1/2 -translate-x-1/2 origin-center'         // in between: centered
}
</script>

<template>
  <div class="w-full mb-8 px-2"> 
    <div class="relative">
      <div class="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -translate-y-1/2 rounded-full"></div>

      <div 
        class="absolute top-1/2 left-0 h-1 bg-emerald-500 -translate-y-1/2 rounded-full transition-all duration-500 ease-out"
        :style="{ width: progressWidth }"
      ></div>

      <div class="relative flex justify-between w-full">
        
        <div 
          v-for="item in steps" 
          :key="item.step" 
          class="flex flex-col items-center group relative" 
        >
          <div
            class="flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-bold z-10 transition-all duration-300 bg-white"
            :class="[
              currentStep >= item.step
                ? 'border-emerald-600 text-emerald-600 shadow-[0_0_10px_rgb(var(--color-success)/0.4)]'
                : 'border-gray-300 text-gray-400',
              // Fill the circle green once the step is done.
              currentStep > item.step ? '!bg-emerald-600 !text-white' : '',
              // Current step: pulse subtly so the user always sees where they are.
              currentStep === item.step ? 'text-emerald-600 animate-step-pulse' : ''
            ]"
          >
            <Check v-if="currentStep > item.step" :size="16" />
            <span v-else>{{ item.step }}</span>
          </div>

          <span 
            class="absolute top-10 text-xs font-bold uppercase tracking-wider transition-colors duration-300 whitespace-nowrap"
            :class="[
              currentStep >= item.step ? 'text-emerald-700' : 'text-gray-400',
              getTextAlignmentClass(item.step, steps.length)
            ]"
          >
            {{ t(item.key) }}
          </span>
        </div>

      </div>
    </div>
    
    <div class="h-6"></div>
  </div>
</template>

<style scoped>
/* Scale the circle slightly instead of using Tailwind's animate-pulse (which
   modulates opacity and half-hides the current step), so it stays fully visible.
   transform-origin is centered so its position on the line doesn't wobble. */
@keyframes step-pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 10px rgb(var(--color-success) / 0.4);
  }
  50% {
    transform: scale(1.18);
    box-shadow: 0 0 14px rgb(var(--color-success) / 0.6);
  }
}

.animate-step-pulse {
  animation: step-pulse 1.6s ease-in-out infinite;
  transform-origin: center;
}
</style>