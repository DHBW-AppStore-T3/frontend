<script setup lang="ts">
import { useTheme } from '@/theme/useTheme'

const { brand, authLogo } = useTheme()
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-primary">

    <!-- Card -->
    <div class="w-full max-w-md bg-white rounded-2xl shadow-xl p-10">

      <!-- Logo / Titel -->
      <div class="text-center" :class="authLogo ? 'mb-6' : 'mb-8'">
        <img v-if="authLogo" :src="authLogo.src" :alt="authLogo.alt" :style="{ height: `${authLogo.height}px` }" class="mx-auto block" />
        <h1 v-else class="text-3xl font-bold text-primary">{{ brand.name }}</h1>
        <p class="text-gray-500" :class="authLogo ? 'mt-3 leading-none' : 'mt-2'">
          {{ brand.tagline }}
        </p>
      </div>

      <!-- Seiteninhalt -->
      <slot />

    </div>
  </div>
</template>
