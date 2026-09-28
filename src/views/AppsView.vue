<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import AppLogo from '@/components/ui/AppLogo.vue'
import Card from '@/components/ui/Card.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EntityListState from '@/components/ui/EntityListState.vue'
import AppVersionStatusBadge from '@/components/ui/AppVersionStatusBadge.vue'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import { useRouter } from 'vue-router'
import { appApi } from '@/api/app.api'
import { useI18n } from 'vue-i18n'
import { Inbox, Plus, Globe, Lock, Search, SlidersHorizontal, Star } from 'lucide-vue-next'
import { APP_CATEGORIES, appPresentation, type AppCategory } from '@/config/app-catalog'
import { useFavorites } from '@/composables/useFavorites'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth.store'
import type { App, AppVersionApproval } from '@/types'

const { t, locale } = useI18n()
const toast = useToast()
const router = useRouter()
const authStore = useAuthStore()

const isLoading = ref(false)
const apps = ref<App[]>([])
const approvalsMap = ref<Record<string, AppVersionApproval[]>>({})

// Admin-only filter
const visibilityFilter = ref<'all' | 'public' | 'private'>('all')

const searchQuery = ref('')
const selectedCategory = ref<AppCategory | 'all' | 'favorites'>('all')
const showFilters = ref(false)
const { favorites, toggleFavorite } = useFavorites(computed(() => authStore.userId))
const visibleApps = computed(() => apps.value.filter(app =>
  (!authStore.isAdmin || visibilityFilter.value === 'all' || (visibilityFilter.value === 'private' ? app.is_private : !app.is_private)) &&
  `${app.name} ${app.description ?? ''}`.toLocaleLowerCase().includes(searchQuery.value.trim().toLocaleLowerCase()),
))
const categories = computed(() => [
  { key: 'all' as const, count: visibleApps.value.length },
  ...APP_CATEGORIES.map(key => ({ key, count: visibleApps.value.filter(app => appPresentation(app.name).category === key).length })),
  { key: 'favorites' as const, count: visibleApps.value.filter(app => favorites.value.includes(app.appId)).length },
])
const filteredApps = computed(() => visibleApps.value.filter(app =>
  selectedCategory.value === 'all' ||
  (selectedCategory.value === 'favorites' ? favorites.value.includes(app.appId) : appPresentation(app.name).category === selectedCategory.value),
))

const isOwnApp = (app: App) => String(app.userId) === String(authStore.userId)

const badgeStatusForApp = (app: App) => {
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

const handleDeploy = (app: App, configure = false) => {
  router.push({ name: 'apps.detail', params: { id: app.appId }, hash: configure ? '#deployment-options' : '' })
}

onMounted(() => {
  fetchApps()
})
</script>

<template>
  <div class="app-page">
    <PageHeader :eyebrow="$t('nav.apps')" :title="$t('AppsView.title')" :subtitle="$t('AppsView.subtitle')">
      <template #actions>
        <label class="search-field">
          <Search :size="16" aria-hidden="true" />
          <input v-model="searchQuery" :placeholder="t('workspace.searchApps')" :aria-label="t('workspace.searchApps')" type="search" />
        </label>
        <button v-if="authStore.isAdmin" type="button" class="icon-button" :aria-label="t('workspace.filters')" :aria-expanded="showFilters" @click="showFilters = !showFilters"><SlidersHorizontal :size="16" /></button>
        <!-- Admin-only visibility filter -->
        <div v-if="authStore.isAdmin && showFilters" class="flex items-center bg-surfaceMuted rounded-lg p-1 gap-1 text-sm">
          <button
            @click="visibilityFilter = 'all'"
            class="px-3 py-1.5 rounded-md font-medium transition-colors"
            :class="visibilityFilter === 'all' ? 'bg-white text-textHeading shadow-sm' : 'text-textMuted hover:text-textMuted'"
          >
            {{ $t('AppsView.filterAll') }}
          </button>
          <button
            @click="visibilityFilter = 'public'"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors"
            :class="visibilityFilter === 'public' ? 'bg-white text-textHeading shadow-sm' : 'text-textMuted hover:text-textMuted'"
          >
            <Globe :size="13" />
            {{ $t('AppsView.filterPublic') }}
          </button>
          <button
            @click="visibilityFilter = 'private'"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors"
            :class="visibilityFilter === 'private' ? 'bg-white text-textHeading shadow-sm' : 'text-textMuted hover:text-textMuted'"
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

    <div class="catalog-tabs" :aria-label="t('workspace.categories.label')">
      <button v-for="category in categories" :key="category.key" type="button" class="catalog-tab"
        :aria-pressed="selectedCategory === category.key" @click="selectedCategory = category.key">
        {{ t(`workspace.categories.${category.key}`) }} <span class="catalog-count">{{ category.count }}</span>
      </button>
    </div>

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

      <div class="app-catalog-grid">
        <Card v-for="app in filteredApps" :key="app.appId" class="catalog-card">
          <div class="catalog-card-top">
            <AppLogo :name="app.name" :image="app.image" />
            <button type="button" class="favorite-button" :aria-label="t('workspace.favorite', { name: app.name })"
              :aria-pressed="favorites.includes(app.appId)" @click="toggleFavorite(app.appId)">
              <Star :size="18" :fill="favorites.includes(app.appId) ? 'currentColor' : 'none'" />
            </button>
          </div>
          <RouterLink :to="{ name: 'apps.detail', params: { id: app.appId } }" class="catalog-app-name">{{ app.name }}</RouterLink>
          <AppVersionStatusBadge v-if="badgeStatusForApp(app)" :status="badgeStatusForApp(app)!" class="self-start" />
          <div :lang="locale" class="catalog-description">
            <MarkdownRenderer v-if="app.description?.trim()" :source="app.description" variant="compact" :clamp="3" />
            <p v-else>{{ t('AppsView.noDescription') }}</p>
          </div>
          <div class="catalog-card-actions">
            <BaseButton @click="handleDeploy(app)">{{ t('workspace.details') }}</BaseButton>
            <BaseButton variant="outline" @click="handleDeploy(app, true)">{{ t('workspace.deploy') }}</BaseButton>
          </div>
        </Card>
      </div>
    </EntityListState>
  </div>
</template>

<style scoped>
.app-catalog-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
.catalog-card { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 22px; }
.catalog-card-top { display: flex; justify-content: space-between; align-items: flex-start; }
.favorite-button { color: rgb(var(--color-text-muted)); padding: 4px; }
.favorite-button[aria-pressed='true'] { color: rgb(var(--color-primary)); }
.catalog-app-name { font-size: 17px; font-weight: 650; color: rgb(var(--color-text-heading)); }
.catalog-description { flex: 1; min-height: 66px; color: rgb(var(--color-text-muted)); font-size: 13px; line-height: 1.7; }
.catalog-card-actions { display: flex; gap: 10px; margin-top: 8px; }
.catalog-card-actions button { flex: 1; padding-inline: 10px; }
@media (max-width: 1100px) { .app-catalog-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) { .app-catalog-grid { grid-template-columns: 1fr; } }
</style>
