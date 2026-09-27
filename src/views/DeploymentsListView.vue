<script setup lang="ts">
import { onMounted, computed } from 'vue'

import {
  BarChart3,
  Plus,
  Inbox,
  GitBranch,
  Box,
  Clock,
} from 'lucide-vue-next'

import BaseButton from '@/components/ui/BaseButton.vue'
import Card from '@/components/ui/Card.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EntityListState from '@/components/ui/EntityListState.vue'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useAppStore } from '@/stores/app.store'
import { formatDateTime } from '@/utils/format'

const deploymentStore = useDeploymentStore()
const appStore = useAppStore()

onMounted(async () => {
  deploymentStore.fetchDeployments()
  appStore.fetchApps()
})

const getAppName = (appId: string) => {
  const app = appStore.apps.find(a => a.appId === appId)
  return app ? app.name : '-'
}

// Format a timestamp as date + time (no seconds).
const formatDate = (dateString: string) =>
  formatDateTime(dateString, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

/**
 * Sort newest deployments first.
 *
 * The server returns the list in DB insert order, so we sort client-side by
 * ``created_at`` descending. Items without ``created_at`` fall to the end
 * (better than ``NaN`` in the comparison).
 */
const sortedDeployments = computed(() =>
  [...deploymentStore.deployments].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
    return tb - ta
  })
)

// Status pills. Color semantics: orange = destroy, amber = lifecycle-pending,
// slate = paused.
const getStatusColor = (status: string) => {
  const colors = {
    'success': 'bg-successTint text-green-800 border-green-300',
    'failed': 'bg-dangerTint text-red-800 border-red-300',
    'running': 'bg-infoTint text-blue-800 border-blue-300',
    'pending': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'cancelled': 'bg-surfaceMuted text-textMuted border-borderSubtle',
    'destroyed': 'bg-orange-100 text-orange-800 border-orange-300',
    'destroying': 'bg-orange-100 text-orange-700 border-orange-300',
    'pausing': 'bg-amber-100 text-amber-800 border-amber-300',
    'paused': 'bg-slate-100 text-slate-700 border-slate-300',
    'resuming': 'bg-emerald-100 text-emerald-800 border-emerald-300',
    'pause_failed': 'bg-amber-100 text-amber-900 border-amber-300',
    'resume_failed': 'bg-amber-100 text-amber-900 border-amber-300',
  }
  return colors[status as keyof typeof colors] || 'bg-surfaceMuted text-textHeading border-borderSubtle'
}
</script>


<template>
  <div class="p-6">
    <PageHeader :title="$t('DeploymentsView.title')" :subtitle="$t('DeploymentsView.subtitle')">
      <template #actions>
        <RouterLink :to="{ name: 'apps' }">
          <BaseButton class="flex items-center gap-2">
            <Plus :size="16" />
            {{ $t('DeploymentsView.newDeployment') }}
          </BaseButton>
        </RouterLink>
      </template>
    </PageHeader>

    <EntityListState
      :is-loading="deploymentStore.isLoading && deploymentStore.deployments.length === 0"
      :is-empty="!deploymentStore.isLoading && deploymentStore.deployments.length === 0"
      :icon="Inbox"
      :empty-message="$t('DeploymentsView.deploymentsMissingMessage')"
    >
      <template #empty-action>
        <RouterLink :to="{ name: 'apps' }">
          <BaseButton class="flex items-center gap-2">
            <Plus :size="16" />
            {{ $t('DeploymentsView.newDeployment') }}
          </BaseButton>
        </RouterLink>
      </template>

      <!-- Card grid, one card per deployment (name, app name, status pill,
           release tag, creation date). Click opens the detail; newest first. -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <RouterLink
          v-for="deployment in sortedDeployments"
          :key="deployment.deploymentId"
          :to="{ name: 'deployments.detail', params: { id: deployment.deploymentId } }"
          class="block"
        >
          <Card class="flex flex-col h-full cursor-pointer hover:border-emerald-200 transition">
            <div class="flex items-start justify-between gap-3 mb-3">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BarChart3 :size="20" class="text-primary" />
                </div>
                <div class="min-w-0">
                  <h3 class="font-semibold text-textHeading truncate" :title="deployment.name">
                    {{ deployment.name }}
                  </h3>
                  <p class="text-xs text-textMuted truncate mt-0.5">
                    <Box :size="11" class="inline-block mr-1 align-text-bottom" />
                    {{ getAppName(deployment.appId) }}
                  </p>
                </div>
              </div>
              <span
                class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border capitalize whitespace-nowrap"
                :class="getStatusColor(deployment.status)"
              >
                {{ deployment.status }}
              </span>
            </div>

            <div class="mt-auto pt-3 border-t border-borderSubtle flex items-center justify-between text-xs text-textMuted">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono">
                <GitBranch :size="11" />
                {{ deployment.releaseTag }}
              </span>
              <span class="inline-flex items-center gap-1">
                <Clock :size="11" />
                {{ formatDate(deployment.created_at) }}
              </span>
            </div>
          </Card>
        </RouterLink>
      </div>
    </EntityListState>
  </div>
</template>
