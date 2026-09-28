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
        class="absolute top-1/2 left-0 h-1 bg-primary -translate-y-1/2 rounded-full transition-all duration-500 ease-out"
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
                ? 'border-primary text-primary '
                : 'border-borderSubtle text-textFaint',
              // Completed steps use the primary brand color.
              currentStep > item.step ? '!bg-primary !text-white' : '',
              // Highlight the current step without animation.
              currentStep === item.step ? 'text-primary' : ''
            ]"
          >
            <Check v-if="currentStep > item.step" :size="16" />
            <span v-else>{{ item.step }}</span>
          </div>

          <span
            class="absolute top-10 text-xs font-bold uppercase tracking-wider transition-colors duration-300 whitespace-nowrap"
            :class="[
              currentStep >= item.step ? 'text-primary' : 'text-textFaint',
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
