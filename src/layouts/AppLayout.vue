<script setup lang="ts">
import {
  LayoutDashboard,
  BarChart3,
  Layers,
  GraduationCap,
  HelpCircle,
  User,
  LogOut,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
} from 'lucide-vue-next'

import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth.store'
import { useAuth } from '@/composables/useAuth'
import { useRole } from '@/composables/useRole'
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'

import logo from '@/assets/Six7-white-withoutBackground.png'

const { locale, t } = useI18n()
const authStore = useAuthStore()
const { logout } = useAuth()
const { isAdmin, isStaff } = useRole()
const route = useRoute()

const userName = computed(() => authStore.user?.username || 'User')
const userInitial = computed(() => (authStore.user?.username ?? 'U').charAt(0).toUpperCase())

const isMeshBgActive = computed(() => route.name === 'dashboard' || route.path === '/')

const sidebarCollapsed = ref(false)
const userMenuOpen = ref(false)

const closeUserMenu = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.user-menu-root')) userMenuOpen.value = false
}
onMounted(() => document.addEventListener('click', closeUserMenu))
onBeforeUnmount(() => document.removeEventListener('click', closeUserMenu))

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

const changeLocale = (lang: string) => {
  locale.value = lang
  try {
    localStorage.setItem('locale', lang)
  } catch {
    // Storage is blocked when embedded in a third-party iframe (Moodle LTI);
    // the locale still switches for this session, it just isn't persisted.
  }
}

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

    <!-- Sidebar -->
    <aside
      class="sidebar-bg flex flex-col h-full flex-shrink-0 transition-colors duration-200"
      :class="sidebarCollapsed ? 'w-16' : 'w-60'"
    >

      <!-- Logo area -->
      <div class="h-16 flex items-center border-b border-white/10 px-3" style="overflow: visible;">
        <RouterLink to="/" class="block" style="height: 48px; width: 100%; overflow: visible;">
          <img :src="logo" alt="SIX7 Click'n Deploy" style="position: relative; z-index: 30; height: 96px; margin-top: -24px; margin-left: -8px; max-width: none;" />
        </RouterLink>
      </div>

      <!-- Sidebar toggle inside navigation zone (shown only when collapsed) -->
      <div v-if="sidebarCollapsed" class="px-2 py-2 border-b border-white/5">
        <button
          @click="sidebarCollapsed = false"
          class="sidebar-toggle-btn"
          aria-label="Open sidebar"
        >
          <PanelLeftOpen :size="18" />
        </button>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        <RouterLink
          v-for="item in navItems"
          :key="item.label"
          :to="item.to"
          class="nav-link group"
          :class="sidebarCollapsed ? 'nav-link-collapsed' : ''"
          active-class="nav-link-active"
        >
          <span class="nav-indicator" />
          <component :is="item.icon" :size="21" class="flex-shrink-0 opacity-70 group-[.nav-link-active]:opacity-100" />
          <span
            v-if="!sidebarCollapsed"
            class="transition-opacity duration-150 whitespace-nowrap"
          >{{ $t(item.label) }}</span>
          <!-- Tooltip when collapsed -->
          <span v-if="sidebarCollapsed" class="nav-tooltip">{{ $t(item.label) }}</span>
        </RouterLink>
      </nav>

    </aside>

    <!-- Main area -->
    <div class="flex-1 flex flex-col h-full min-w-0">

      <!-- Header -->
      <header class="h-16 header-bg flex items-center justify-between px-6 flex-shrink-0 border-b border-white/10 relative">

        <!-- Left: toggle (title centered separately) -->
        <div class="flex items-center gap-3">
          <button
            v-if="!sidebarCollapsed"
            @click="sidebarCollapsed = true"
            class="text-white/60 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
            aria-label="Close sidebar"
          >
            <PanelLeftClose :size="20" />
          </button>
        </div>

        <!-- Centered title (always horizontally centered in viewport) -->
        <div class="header-title">
          <span class="text-white/90 text-sm font-medium tracking-wide">{{ pageTitle }}</span>
        </div>

        <!-- Right controls -->
        <div class="flex items-center gap-2">

          <!-- Language toggle -->
          <div class="flex rounded-md overflow-hidden border border-white/20 text-xs">
            <button
              @click="changeLocale('de')"
              :class="locale === 'de' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'"
              class="px-2.5 py-1 transition-colors"
            >DE</button>
            <button
              @click="changeLocale('en')"
              :class="locale === 'en' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'"
              class="px-2.5 py-1 transition-colors border-l border-white/20"
            >EN</button>
          </div>

          <!-- User menu -->
          <div class="relative user-menu-root">
            <button
              @click="userMenuOpen = !userMenuOpen"
              class="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-white/10 transition-colors text-white"
            >
              <div class="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-semibold">
                {{ userInitial }}
              </div>
              <span class="text-sm text-white/90 max-w-24 truncate">{{ userName }}</span>
              <ChevronDown
                :size="14"
                class="text-white/50 transition-transform duration-150"
                :class="userMenuOpen ? 'rotate-180' : ''"
              />
            </button>

            <!-- Dropdown -->
            <Transition name="dropdown">
              <div
                v-if="userMenuOpen"
                class="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50"
              >
                <RouterLink
                  to="/user"
                  @click="userMenuOpen = false"
                  class="flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <User :size="15" class="text-slate-400" />
                  Profil
                </RouterLink>
                <div class="my-1 border-t border-slate-100" />
                <button
                  @click="logout(); userMenuOpen = false"
                  class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut :size="15" />
                  Abmelden
                </button>
              </div>
            </Transition>
          </div>

        </div>
      </header>

      <!-- Main content -->
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
.sidebar-bg {
  background: linear-gradient(180deg, rgb(var(--color-primary)) 0%, rgb(var(--color-primary-deep)) 100%);
}

.header-bg {
  background: rgb(var(--color-primary));
}

/* Nav link base */
.nav-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 12px 13px 18px;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 500;
  color: rgb(var(--color-on-dark) / 0.65);
  transition: background-color 150ms, color 150ms;
  text-decoration: none;
}

.nav-link:hover {
  background-color: rgb(var(--color-on-dark) / 0.08);
  color: rgb(var(--color-on-dark) / 0.9);
}

.nav-link-active {
  background-color: rgb(var(--color-on-dark) / 0.12);
  color: rgb(var(--color-on-dark));
}

/* Collapsed: center icons */
.nav-link-collapsed {
  padding: 13px;
  justify-content: center;
}

/* Left indicator bar */
.nav-indicator {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%) scaleY(0);
  width: 3px;
  height: 60%;
  background: rgb(var(--color-accent-yellow));
  border-radius: 0 2px 2px 0;
  transition: transform 150ms ease;
}

.nav-link-active .nav-indicator {
  transform: translateY(-50%) scaleY(1);
}

/* Tooltip on collapsed state */
.nav-tooltip {
  position: absolute;
  left: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%);
  background: rgb(var(--color-surface-dark));
  color: rgb(var(--color-on-dark));
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
  padding: 4px 8px;
  border-radius: 6px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 100ms ease;
  z-index: 100;
}

.nav-link:hover .nav-tooltip {
  opacity: 1;
}

/* Mesh background */
.mesh-gradient-bg {
  background-color: rgb(var(--color-surface-page));
  background-image:
    radial-gradient(at top left, rgb(var(--color-primary) / 0.18) 0px, transparent 50%),
    radial-gradient(at bottom right, rgb(var(--color-primary) / 0.22) 0px, transparent 55%),
    radial-gradient(at top right, rgb(var(--color-on-dark) / 0.6) 0px, transparent 45%),
    radial-gradient(at bottom left, rgb(var(--color-success) / 0.10) 0px, transparent 50%);
}

/* Logo text fade */
.fade-text-enter-active {
  transition: opacity 150ms ease 100ms, transform 150ms ease 100ms;
}
.fade-text-leave-active {
  transition: opacity 100ms ease, transform 100ms ease;
}

/* Logo sizes for expanded / collapsed sidebar */
.logo-full {
  height: 96px;
  margin-top: -24px;
  margin-left: -8px;
  max-width: none;
}

/* Sidebar toggle appearance */
.sidebar-toggle-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: rgb(var(--color-on-dark) / 0.65);
  transition: background-color 150ms;
}
.sidebar-toggle-btn:hover {
  background: rgb(var(--color-on-dark) / 0.04);
}

/* Header title centered in viewport */
.header-title {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  top: 0;
  height: 4rem; /* matches h-16 */
  display: flex;
  align-items: center;
  z-index: 70;
  pointer-events: none;
}
.header-title span {
  pointer-events: none;
}

/* When collapsed, center the toggle so it doesn't overlap the first nav icon */
.w-16 > .px-2 > .sidebar-toggle-btn,
.w-16 > .px-2 > .sidebar-toggle-btn > * {
  margin-left: auto;
  margin-right: auto;
  display: block;
}

/* Hide native scrollbar when sidebar is collapsed (class w-16 applied on aside) */
.sidebar-bg.w-16 nav {
  /* Firefox */
  scrollbar-width: none;
  /* IE 10+ */
  -ms-overflow-style: none;
}
.sidebar-bg.w-16 nav::-webkit-scrollbar {
  width: 0;
  height: 0;
}

/* Sidebar scroll controls placed at bottom when expanded */

.fade-text-enter-from,
.fade-text-leave-to {
  opacity: 0;
  transform: translateX(-6px);
}

/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
