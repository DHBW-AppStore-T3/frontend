<script setup lang="ts">
import {
  House,
  LayoutGrid,
  User,

  Layers,
  GraduationCap,
  HelpCircle,
  ShieldCheck,
} from 'lucide-vue-next'

import { useI18n } from 'vue-i18n'
import { useRole } from '@/composables/useRole'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useTheme } from '@/theme/useTheme'

import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'
import '@/theme/workspace.css'

const { t } = useI18n()
const { isAdmin, isStaff } = useRole()
const route = useRoute()
const theme = useTheme()

const isDashboard = computed(() => route.name === 'dashboard' || route.path === '/')

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
  { to: '/', label: 'nav.dashboard', icon: House },
  { to: { name: 'deployments.list' }, label: 'nav.deployments', icon: Layers },
  { to: '/apps', label: 'nav.apps', icon: LayoutGrid },
  { to: '/courses', label: 'nav.courses', icon: GraduationCap, visible: isStaff.value },
  { to: '/admin/apps', label: 'nav.approvals', icon: ShieldCheck, visible: isAdmin.value },
  { to: '/user', label: 'workspace.profile', icon: User, visible: route.path.startsWith('/user') },
  { to: '/help', label: 'nav.help', icon: HelpCircle },
].filter(item => item.visible !== false))
</script>

<template>
  <div class="app-shell">
    <AppSidebar
      v-model:collapsed="sidebarCollapsed"
      :nav-items="navItems"
      :mobile-open="mobileMenuOpen"
      @close-mobile="mobileMenuOpen = false"
    />

    <div class="app-workspace" :class="{ 'app-workspace--dashboard': isDashboard }" :style="theme.loginBackground ? { '--workspace-dashboard-image': `url(${theme.loginBackground})` } : undefined">
      <AppHeader
        :page-title="pageTitle"
        :sidebar-collapsed="sidebarCollapsed"
        @toggle-sidebar="sidebarCollapsed = !sidebarCollapsed"
        @open-mobile-menu="mobileMenuOpen = true"
      />

      <main
        class="app-main"
      >
        <slot />
      </main>
    </div>
  </div>
</template>
