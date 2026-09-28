<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  BarChart3, Layers, GraduationCap, ArrowRight,
  XCircle, Loader2, AlertCircle
} from 'lucide-vue-next'
import { useDashboard } from '@/composables/useDashboard'
import { useQuotas } from '@/composables/useQuotas'
import { useOpenStackCredentialsStore } from '@/stores/openstack-credentials.store'
import { useAuthStore } from '@/stores/auth.store'
import { useRole } from '@/composables/useRole'
import CredentialMissingBanner from '@/components/CredentialMissingBanner.vue'

const { stats, fetchStats } = useDashboard()
const { formattedQuotas, loading: quotasLoading, needsCredentials, hasCachedQuotas, fetchQuotas, getColorClass } = useQuotas()
const credStore = useOpenStackCredentialsStore()
const authStore = useAuthStore()
const { t } = useI18n()
const { isStaff } = useRole()

const firstName = computed(() => {
  const name = authStore.user?.username || ''
  return name.charAt(0).toUpperCase() + name.slice(1)
})

const timeGreeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return t('DashboardView.timeGreetings.morning')
  if (h < 18) return t('DashboardView.timeGreetings.afternoon')
  return t('DashboardView.timeGreetings.evening')
})

onMounted(() => {
  fetchStats()
  fetchQuotas()
  if (!credStore.status) credStore.fetch()
})
</script>

<template>
  <div class="dashboard-page">

    <!-- Banners -->
    <CredentialMissingBanner
      v-if="credStore.isResolved && !credStore.hasCredential"
      variant="warning"
      :title="t('banners.credentialsMissing.title')"
      :message="t('banners.credentialsMissing.message')"
      :cta="t('banners.credentialsMissing.cta')"
      ctaTo="/user/openstack"
    />
    <CredentialMissingBanner
      v-else-if="credStore.isResolved && credStore.lastError"
      variant="error"
      :title="t('banners.credentialsInvalid.title')"
      :message="credStore.lastError"
      :cta="t('banners.credentialsInvalid.cta')"
      ctaTo="/user/openstack"
    />

    <!-- Hero banner -->
    <div class="hero-banner">
      <div class="hero-content">
        <p class="page-eyebrow">{{ timeGreeting }}</p>
        <h1 class="dashboard-name">{{ firstName }}</h1>
        <p class="dashboard-subtitle">{{ $t('DashboardView.subtitle') }}</p>
      </div>

    </div>

    <!-- KPI row -->
    <div class="kpi-row">
      <RouterLink :to="{ name: 'deployments.list' }" class="kpi-item group">
        <div class="kpi-icon-wrap" style="background:rgb(var(--color-primary) / 0.10)">
          <BarChart3 :size="16" class="text-primary" />
        </div>
        <div>
          <p class="kpi-num">{{ stats.deployments }}</p>
          <p class="kpi-lbl">{{ $t('DashboardView.deployments') }}</p>
        </div>
        <ArrowRight :size="14" class="ml-auto text-textFaint group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </RouterLink>



      <RouterLink to="/apps" class="kpi-item group">
        <div class="kpi-icon-wrap" style="background:rgb(var(--color-brand-accent) / 0.10)">
          <Layers :size="16" class="text-brandAccent" />
        </div>
        <div>
          <p class="kpi-num">{{ stats.apps }}</p>
          <p class="kpi-lbl">{{ $t('DashboardView.apps') }}</p>
        </div>
        <ArrowRight :size="14" class="ml-auto text-textFaint group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </RouterLink>

      <!-- Courses tile: students have no courses access (staff-only route),
           so hide the tile via RoleGate instead of 404 on click. -->
      <template v-if="isStaff">


      <RouterLink to="/courses" class="kpi-item group">
        <div class="kpi-icon-wrap" style="background:rgb(var(--color-info) / 0.08)">
          <GraduationCap :size="16" class="text-info" />
        </div>
        <div>
          <p class="kpi-num">{{ stats.courses }}</p>
          <p class="kpi-lbl">{{ $t('DashboardView.courses') }}</p>
        </div>
        <ArrowRight :size="14" class="ml-auto text-textFaint group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </RouterLink>
      </template>
    </div>

    <!-- Available resources — full width, two-column quotas list -->
    <div class="dashboard-resources ui-card">
      <div class="flex items-center justify-between px-6 py-4 border-b border-borderSubtle">
        <h2 class="text-sm font-semibold text-textHeading">{{ $t('DashboardView.availableResources') }}</h2>
        <span v-if="quotasLoading && hasCachedQuotas" class="flex items-center gap-1.5 text-xs text-textFaint">
          <Loader2 :size="12" class="animate-spin" />
        </span>
      </div>

      <!-- Skeleton (initial load) -->
      <div v-if="quotasLoading && !hasCachedQuotas" class="quota-grid">
        <div v-for="i in 6" :key="i" class="animate-pulse space-y-2">
          <div class="flex justify-between">
            <div class="h-3 bg-surfaceMuted rounded w-20" />
            <div class="h-3 bg-surfaceMuted rounded w-10" />
          </div>
          <div class="h-1.5 bg-surfaceMuted rounded-full" />
        </div>
      </div>

      <!-- Quotas: two columns on >= md -->
      <div v-else-if="formattedQuotas.length > 0" class="quota-grid">
        <div v-for="quota in formattedQuotas" :key="quota.label" class="quota-item">
          <component :is="quota.icon" :size="28" :stroke-width="1.5" class="quota-icon" aria-hidden="true" />
          <div class="quota-content">
          <div class="flex items-center justify-between mb-1.5">
            <div class="flex items-center gap-1.5">
              <span class="text-sm font-semibold text-textHeading">{{ quota.label }}</span>
            </div>
            <span
              class="text-xs font-semibold tabular-nums"
              :class="quota.percentage >= 80 ? 'text-danger' : quota.percentage >= 60 ? 'text-warning' : 'text-textMuted'"
            >
              {{ quota.used }}/{{ quota.limit }}{{ quota.unit }}
            </span>
          </div>
          <div class="w-full bg-surfaceMuted rounded-full h-1.5 overflow-hidden">
            <div
              :class="getColorClass(quota.percentage)"
              class="h-1.5 rounded-full transition-all duration-700"
              :style="{ width: `${quota.percentage}%` }"
            />
          </div>
          <div class="flex items-center justify-between mt-1.5">
            <p class="text-xs text-textFaint">{{ t('DashboardView.quotaUsed', { percentage: quota.percentage }) }}</p>
            <AlertCircle v-if="quota.percentage >= 80" :size="11" class="text-danger" />
          </div>
          </div>
        </div>
      </div>
      <!-- No credentials -->
      <div v-else-if="needsCredentials" class="px-6 py-12 text-center">
        <div class="w-12 h-12 rounded-full bg-surfaceMuted flex items-center justify-center mx-auto mb-3">
          <XCircle :size="22" class="text-textFaint" />
        </div>
        <p class="text-sm font-medium text-textMuted">{{ t('DashboardView.noCredentialsTitle') }}</p>
        <p class="text-xs text-textFaint mt-1 mb-4">{{ t('DashboardView.noCredentialsHint') }}</p>
        <RouterLink
          to="/user/openstack"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primaryDark transition-colors"
        >
          {{ t('DashboardView.setUpNow') }} <ArrowRight :size="12" />
        </RouterLink>
      </div>

      <!-- Error / no data -->
      <div v-else class="px-6 py-12 text-center">
        <p class="text-sm text-textFaint">{{ t('DashboardView.quotaLoadError') }}</p>
      </div>
    </div>

  </div>
</template>

<style scoped>
.dashboard-page { display: flex; flex-direction: column; gap: 28px; }
.hero-banner { min-height: 230px; display: flex; align-items: center; position: relative; }
.hero-content { max-width: 440px; padding-bottom: 16px; }
.dashboard-name { font-size: clamp(34px, 3vw, 50px); font-weight: 750; letter-spacing: -.045em; color: rgb(var(--color-text-heading)); line-height: 1.2; margin-bottom: 8px; }
.dashboard-subtitle { color: rgb(var(--color-text-muted)); font-size: 19px; line-height: 1.5; max-width: 380px; }
.kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 24px; }
.kpi-item { display: flex; align-items: center; gap: 20px; padding: 24px; border: 1px solid rgb(var(--color-border-subtle)); border-radius: var(--workspace-card-radius); background: var(--workspace-surface); box-shadow: var(--workspace-card-shadow); backdrop-filter: blur(12px); }
.kpi-item:hover { border-color: rgb(var(--color-primary) / .3); }
.kpi-icon-wrap { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 9px; flex-shrink: 0; }
.kpi-icon-wrap svg { width: 24px; height: 24px; stroke-width: 1.5; }
.kpi-num { font-size: 32px; font-weight: 700; line-height: 1.2; color: rgb(var(--color-text-heading)); }
.kpi-lbl { font-size: 15px; color: rgb(var(--color-text-muted)); margin-top: 2px; }
.dashboard-resources { padding: 0; overflow: hidden; }
.quota-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 30px 64px; padding: 28px 32px; }
.quota-item { display: flex; gap: 28px; align-items: flex-start; }
.quota-icon { color: rgb(var(--color-text-muted)); flex-shrink: 0; margin-top: 2px; }
.quota-content { flex: 1; min-width: 0; }
@media (max-width: 1100px) { .hero-content { max-width: 340px; } .dashboard-subtitle { font-size: 17px; } .kpi-item { padding: 20px; gap: 14px; } .quota-grid { gap: 26px; padding: 24px; } .quota-item { gap: 16px; } }
@media (max-width: 767px) { .hero-banner { min-height: 190px; } .kpi-row { grid-template-columns: 1fr; gap: 12px; } .kpi-item { padding: 16px 20px; } .quota-grid { grid-template-columns: 1fr; } }
</style>
