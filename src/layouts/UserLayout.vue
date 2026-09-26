<script setup lang="ts">
import { ArrowLeft, User } from 'lucide-vue-next'
</script>

<template>
  <div class="min-h-screen bg-bgSoft flex flex-col">

    <!-- Header -->
    <header
      class="h-16 bg-primary text-white flex items-center justify-between px-8
             border-b-2 border-brandAccent"
    >
      <div class="flex items-center gap-4">
        <RouterLink
          to="/dashboard"
          class="hover:text-brandAccent transition flex items-center gap-2"
        >
          <ArrowLeft :size="20" />
          {{ $t('action.back') }}
        </RouterLink>

        <span class="font-semibold tracking-wide">
          {{ $t('user.title') }}
        </span>
      </div>

      <User :size="20" class="opacity-80" />
    </header>

    <!-- Content -->
    <main class="flex-1 p-10 flex justify-center">
      <div class="w-full max-w-3xl">
        <slot />
      </div>
    </main>

  </div>
</template>
