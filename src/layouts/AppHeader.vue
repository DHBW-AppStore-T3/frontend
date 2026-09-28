<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Menu, User, LogOut, ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth.store'
import { useAuth } from '@/composables/useAuth'
defineProps<{ pageTitle: string; sidebarCollapsed: boolean }>()
const emit = defineEmits<{ 'toggle-sidebar': []; 'open-mobile-menu': [] }>()
const { t } = useI18n()
const authStore = useAuthStore()
const { logout } = useAuth()
const userName = computed(() => authStore.user?.username || t('workspace.profile'))
const userInitial = computed(() => userName.value.charAt(0).toUpperCase())
const userMenuOpen = ref(false)
const menu = ref<HTMLElement | null>(null)
function closeOnOutsideClick(event: MouseEvent) {
  if (!menu.value?.contains(event.target as Node)) userMenuOpen.value = false
}
onMounted(() => document.addEventListener('click', closeOnOutsideClick))
onBeforeUnmount(() => document.removeEventListener('click', closeOnOutsideClick))
</script>

<template>
  <header class="app-header">
    <button data-testid="mobile-menu-toggle" type="button" class="icon-button md:hidden"
      :aria-label="t('workspace.openMenu')" @click="emit('open-mobile-menu')"><Menu :size="20" /></button>
    <button type="button" class="icon-button sidebar-collapse hidden md:inline-flex"
      :aria-label="t(sidebarCollapsed ? 'workspace.openSidebar' : 'workspace.closeSidebar')" @click="emit('toggle-sidebar')">
      <component :is="sidebarCollapsed ? PanelLeftOpen : PanelLeftClose" :size="18" />
    </button>
    <span class="sr-only">{{ pageTitle }}</span>
    <div ref="menu" class="user-menu-root" @keydown.esc="userMenuOpen = false">
      <button type="button" class="user-menu-trigger" :aria-expanded="userMenuOpen" aria-controls="account-menu" @click="userMenuOpen = !userMenuOpen">
        <span class="user-avatar">{{ userInitial }}</span>
        <span class="user-menu-name">{{ userName }}</span>
        <ChevronDown :size="14" aria-hidden="true" />
      </button>
      <div v-if="userMenuOpen" id="account-menu" class="user-menu-panel">
        <RouterLink to="/user" @click="userMenuOpen = false"><User :size="16" />{{ t('workspace.profile') }}</RouterLink>
        <button type="button" @click="logout(); userMenuOpen = false"><LogOut :size="16" />{{ t('workspace.logout') }}</button>
      </div>
    </div>
  </header>
</template>
