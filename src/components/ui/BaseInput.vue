<script setup lang="ts">
defineProps<{
  modelValue?: string
  placeholder?: string
  type?: string
}>()
defineEmits(['update:modelValue'])
</script>

<template>
  <input
    :type="type || 'text'"
    :placeholder="placeholder"
    :value="modelValue"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    class="w-full rounded-xl border border-gray-300 px-4 py-2
           focus:outline-none focus:ring-2 focus:ring-primaryAction
           focus:border-primaryAction transition"
  />
</template>
