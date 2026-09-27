<script setup lang="ts">
import {
  LayoutDashboard,
  BarChart3,
  Layers,
  GraduationCap,
  HelpCircle,
  ShieldCheck,
} from 'lucide-vue-next'

import { useI18n } from 'vue-i18n'
import { useRole } from '@/composables/useRole'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'

const { t } = useI18n()
const { isAdmin, isStaff } = useRole()
const route = useRoute()

const isMeshBgActive = computed(() => route.name === 'dashboard' || route.path === '/')

const sidebarCollapsed = ref(false)
const mobileMenuOpen = ref(false)

const pageTitle = computed(() => {
  const name = route.name as string | undefined
  const path = route.path as string

  if (name === 'dashboard' || name === 'home' || path === '/') return t('nav.dashboard')
  if (name?.startsWith('deployments') || path.startsWith('/deployments')) return t('nav.deployments')
  if (name?.startsWith('apps') || path.startsWith('/apps')) return t('nav.apps')
  if (name === 'courses' || path === '/courses' || path.startsWith('/courses')) return t('nav.courses')
  if (name === 'help' || path === '/help') return t('nav.help')
  if (name === 'config') return t('nav.config')
  if (name === 'admin.apps') return t('nav.approvals')
  return ''
})

const navItems = computed(() => [
  { to: '/', label: 'nav.dashboard', icon: LayoutDashboard },
  { to: { name: 'deployments.list' }, label: 'nav.deployments', icon: BarChart3 },
  { to: '/apps', label: 'nav.apps', icon: Layers },
  { to: '/courses', label: 'nav.courses', icon: GraduationCap, visible: isStaff.value },
  { to: '/admin/apps', label: 'nav.approvals', icon: ShieldCheck, visible: isAdmin.value },
  { to: '/help', label: 'nav.help', icon: HelpCircle },
].filter(item => item.visible !== false))
</script>

<template>
  <div class="h-screen flex bg-bgSoft overflow-x-visible">
    <AppSidebar
      v-model:collapsed="sidebarCollapsed"
      :nav-items="navItems"
      :mobile-open="mobileMenuOpen"
      @close-mobile="mobileMenuOpen = false"
    />

    <div class="flex-1 flex flex-col h-full min-w-0">
      <AppHeader
        :page-title="pageTitle"
        :sidebar-collapsed="sidebarCollapsed"
        @toggle-sidebar="sidebarCollapsed = !sidebarCollapsed"
        @open-mobile-menu="mobileMenuOpen = true"
      />

      <main
        class="flex-1 overflow-y-auto px-8 pt-6 pb-8"
        :class="isMeshBgActive ? 'mesh-gradient-bg' : 'bg-bgSoft'"
      >
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.mesh-gradient-bg {
  background-color: rgb(var(--color-surface-page));
  background-image:
    radial-gradient(at top left, rgb(var(--color-primary) / 0.18) 0px, transparent 50%),
    radial-gradient(at bottom right, rgb(var(--color-primary) / 0.22) 0px, transparent 55%),
    radial-gradient(at top right, rgb(var(--color-on-dark) / 0.6) 0px, transparent 45%),
    radial-gradient(at bottom left, rgb(var(--color-success) / 0.10) 0px, transparent 50%);
}
</style>
