<script setup lang="ts">
import { computed } from 'vue'
import { Globe, Clock, XCircle, MinusCircle, Lock } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { AppVersionBadgeStatus } from '@/types'
import Badge from './Badge.vue'

const props = defineProps<{ status: AppVersionBadgeStatus }>()
const { t } = useI18n()

const config = computed(() => {
  switch (props.status) {
    case 'new':
      return { icon: MinusCircle, label: t('AppVersionStatusBadge.new'), variant: 'neutral' as const }
    case 'pending':
      return { icon: Clock, label: t('AppVersionStatusBadge.pending'), variant: 'warning' as const }
    case 'approved':
    case 'published':
      return { icon: Globe, label: t('AppVersionStatusBadge.published'), variant: 'success' as const }
    case 'rejected':
      return { icon: XCircle, label: t('AppVersionStatusBadge.rejected'), variant: 'danger' as const }
    case 'private':
      return { icon: Lock, label: t('AppVersionStatusBadge.private'), variant: 'brand' as const }
    default:
      return { icon: MinusCircle, label: '-', variant: 'neutral' as const }
  }
})
</script>

<template>
  <Badge :variant="config.variant" bordered>
    <component :is="config.icon" :size="11" class="mr-1" />
    {{ config.label }}
  </Badge>
</template>
