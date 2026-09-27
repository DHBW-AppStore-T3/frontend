<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import Card from '@/components/ui/Card.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EntityListState from '@/components/ui/EntityListState.vue'
import AppVersionStatusBadge from '@/components/ui/AppVersionStatusBadge.vue'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import { useRouter } from 'vue-router'
import { appApi } from '@/api/app.api'
import { useI18n } from 'vue-i18n'
import {
  Layers, Server, Box, Database, Terminal,
  Globe, LayoutTemplate, Shield, Inbox, Plus, Lock
} from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth.store'
import type { AppVersionApproval } from '@/types'

const { t, locale } = useI18n()
const toast = useToast()
const router = useRouter()
const authStore = useAuthStore()

const isLoading = ref(false)
const apps = ref<any[]>([])
const approvalsMap = ref<Record<string, AppVersionApproval[]>>({})

// Admin-only filter
const visibilityFilter = ref<'all' | 'public' | 'private'>('all')

const filteredApps = computed(() => {
  if (!authStore.isAdmin || visibilityFilter.value === 'all') return apps.value
  if (visibilityFilter.value === 'private') return apps.value.filter(a => a.is_private)
  return apps.value.filter(a => !a.is_private)
})

const getIconForApp = (app: any) => {
  const name = (app.name || '').toLowerCase()
  if (name.includes('node')) return Server
  if (name.includes('vue') || name.includes('front')) return LayoutTemplate
  if (name.includes('react')) return Globe
  if (name.includes('python') || name.includes('jupyter') || name.includes('fastapi')) return Box
  if (name.includes('postgres') || name.includes('sql') || name.includes('data')) return Database
  if (name.includes('docker') || name.includes('container')) return Terminal
  if (name.includes('security') || name.includes('pen')) return Shield
  return Layers
}

const isOwnApp = (app: any) => String(app.userId) === String(authStore.userId)

const badgeStatusForApp = (app: any) => {
  if (!isOwnApp(app)) return null
  if (app.is_private) return 'private'
  const approvals = approvalsMap.value[app.appId] ?? []
  if (approvals.some(a => a.status === 'approved')) return 'published'
  if (approvals.some(a => a.status === 'pending')) return 'pending'
  return 'new'
}

const fetchApps = async () => {
  isLoading.value = true
  try {
    const response = await appApi.list()
    apps.value = (response.data && Array.isArray(response.data)) ? response.data : []
    const ownApps = apps.value.filter(isOwnApp)
    await Promise.allSettled(
      ownApps.map(async (app) => {
        try {
          const res = await appApi.listVersionApprovals(app.appId)
          approvalsMap.value[app.appId] = res.data
        } catch {
          approvalsMap.value[app.appId] = []
        }
      })
    )
  } catch (error) {
    console.error('Fehler beim Laden der Apps:', error)
    toast.error(t('AppsView.loadError'))
    apps.value = []
  } finally {
    isLoading.value = false
  }
}

const handleDeploy = (app: any) => {
  router.push({ name: 'apps.detail', params: { id: app.id || app._id || app.appId } })
}

onMounted(() => {
  fetchApps()
})
</script>

<template>
  <div class="p-6">
    <PageHeader :title="$t('AppsView.title')" :subtitle="$t('AppsView.subtitle')">
      <template #actions>
        <!-- Admin-only visibility filter -->
        <div v-if="authStore.isAdmin" class="flex items-center bg-gray-100 rounded-lg p-1 gap-1 text-sm">
          <button
            @click="visibilityFilter = 'all'"
            class="px-3 py-1.5 rounded-md font-medium transition-colors"
            :class="visibilityFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
          >
            {{ $t('AppsView.filterAll') }}
          </button>
          <button
            @click="visibilityFilter = 'public'"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors"
            :class="visibilityFilter === 'public' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
          >
            <Globe :size="13" />
            {{ $t('AppsView.filterPublic') }}
          </button>
          <button
            @click="visibilityFilter = 'private'"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors"
            :class="visibilityFilter === 'private' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
          >
            <Lock :size="13" />
            {{ $t('AppsView.filterPrivate') }}
          </button>
        </div>

        <RouterLink :to="{ name: 'apps.create' }">
          <BaseButton class="flex items-center gap-2">
            <Plus :size="16" />
            {{ $t('AppsView.addApp') }}
          </BaseButton>
        </RouterLink>
      </template>
    </PageHeader>

    <EntityListState
      :is-loading="isLoading && apps.length === 0"
      :is-empty="!isLoading && filteredApps.length === 0"
      :icon="Inbox"
      :empty-message="visibilityFilter === 'private' ? $t('AppsView.noPrivateApps') : visibilityFilter === 'public' ? $t('AppsView.noPublicApps') : $t('AppsView.noAppsDesc')"
      :loading-message="$t('AppsView.loading')"
    >
      <template #empty-action>
        <RouterLink v-if="visibilityFilter === 'all'" :to="{ name: 'apps.create' }">
          <BaseButton class="flex items-center gap-2">
            <Plus :size="16" />
            {{ $t('AppsView.addApp') }}
          </BaseButton>
        </RouterLink>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card
          v-for="app in filteredApps"
          :key="app.appId || app.id"
          class="flex flex-col group h-full relative cursor-pointer hover:border-emerald-200"
          @click="handleDeploy(app)"
        >
          <div v-if="badgeStatusForApp(app)" class="absolute top-3 right-3">
            <AppVersionStatusBadge :status="badgeStatusForApp(app)!" />
          </div>

          <div class="flex items-center gap-4 mb-4">
            <div class="bg-gray-50 p-3 rounded-lg text-gray-700 group-hover:text-primary transition-colors flex items-center justify-center w-[56px] h-[56px] flex-shrink-0 border border-gray-100">
              <img v-if="app.image" :src="app.image" :alt="app.name" class="w-full h-full object-contain" />
              <component v-else :is="getIconForApp(app)" :size="32" />
            </div>
            <h3 class="font-bold text-xl text-gray-900 leading-tight pr-16">{{ app.name }}</h3>
          </div>

          <div :lang="locale" class="text-sm mb-6 flex-grow text-left break-words hyphens-auto">
            <MarkdownRenderer
              v-if="app.description && app.description.trim()"
              :source="app.description"
              variant="compact"
              :clamp="3"
              :expandable="true"
            />
            <p v-else class="text-gray-600 leading-relaxed">
              {{ $t('AppsView.noDescription') }}
            </p>
          </div>

          <div class="mt-auto">
            <BaseButton
              variant="secondary"
              class="w-full flex items-center justify-center gap-2"
              @click.stop="handleDeploy(app)"
            >
              {{ $t('AppsView.detailsDeploy') }}
            </BaseButton>
          </div>
        </Card>
      </div>
    </EntityListState>
  </div>
</template>
