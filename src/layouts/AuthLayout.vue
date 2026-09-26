<script setup lang="ts">
import { useTheme } from '@/theme/useTheme'

const { brand } = useTheme()
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-primary">

    <!-- Card -->
    <div class="w-full max-w-md bg-white rounded-2xl shadow-xl p-10">

      <!-- Logo / Titel -->
      <div class="mb-8 text-center">
        <h1 class="text-3xl font-bold text-primary">{{ brand.name }}</h1>
        <p class="text-gray-500 mt-2">
          {{ brand.tagline }}
        </p>
      </div>

      <!-- Seiteninhalt -->
      <slot />

    </div>
  </div>
</template>
