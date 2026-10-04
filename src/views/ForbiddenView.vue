<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ShieldAlert } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/ui/BaseButton.vue'

/**
 * 403 hint view. Rendered when the router guard blocks a route change due to a
 * missing role. A toast already reported the reason; this page gives the user a
 * way back.
 */
const router = useRouter()
const { t } = useI18n()

const goHome = () => {
  router.replace('/dashboard')
}
</script>

<template>
  <div class="min-h-[60vh] flex items-center justify-center p-6">
    <div class="text-center max-w-md">
      <div class="mx-auto w-16 h-16 rounded-full bg-dangerTint flex items-center justify-center mb-4">
        <ShieldAlert :size="32" class="text-danger" />
      </div>
      <h1 class="text-2xl font-bold text-textHeading mb-2">
        {{ t('ForbiddenView.title') }}
      </h1>
      <p class="text-textMuted mb-6">
        {{ t('ForbiddenView.description') }}
      </p>
      <BaseButton @click="goHome">
        {{ t('ForbiddenView.backToDashboard') }}
      </BaseButton>
    </div>
  </div>
</template>
