<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Menu, User, LogOut, ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth.store'
import { useAuth } from '@/composables/useAuth'

defineProps<{ pageTitle: string; sidebarCollapsed: boolean }>()
const emit = defineEmits<{
  (e: 'toggle-sidebar'): void
  (e: 'open-mobile-menu'): void
}>()

const { locale } = useI18n()
const authStore = useAuthStore()
const { logout } = useAuth()

const userName = computed(() => authStore.user?.username || 'User')
const userInitial = computed(() => (authStore.user?.username ?? 'U').charAt(0).toUpperCase())

const userMenuOpen = ref(false)
const closeUserMenu = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.user-menu-root')) userMenuOpen.value = false
}
onMounted(() => document.addEventListener('click', closeUserMenu))
onBeforeUnmount(() => document.removeEventListener('click', closeUserMenu))

const changeLocale = (lang: string) => {
  locale.value = lang
  try {
    localStorage.setItem('locale', lang)
  } catch {
    // Storage is blocked when embedded in a third-party iframe (Moodle LTI);
    // the locale still switches for this session, it just isn't persisted.
  }
}
</script>

<template>
  <header class="h-16 header-bg flex items-center justify-between px-4 md:px-6 flex-shrink-0 border-b border-white/10">

    <!-- Left: mobile hamburger + desktop sidebar toggle -->
    <div class="flex items-center gap-3">
      <button
        data-testid="mobile-menu-toggle"
        @click="emit('open-mobile-menu')"
        class="md:hidden text-white/60 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
        aria-label="Open menu"
      >
        <Menu :size="20" />
      </button>
      <button
        v-if="!sidebarCollapsed"
        @click="emit('toggle-sidebar')"
        class="hidden md:inline-flex text-white/60 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
        aria-label="Close sidebar"
      >
        <PanelLeftClose :size="20" />
      </button>
      <button
        v-else
        @click="emit('toggle-sidebar')"
        class="hidden md:inline-flex text-white/60 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
        aria-label="Open sidebar"
      >
        <PanelLeftOpen :size="20" />
      </button>
    </div>

    <!-- Title: flex layout, no fixed positioning -->
    <div class="flex-1 flex justify-center min-w-0 px-2">
      <span class="text-white/90 text-sm font-medium tracking-wide truncate">{{ pageTitle }}</span>
    </div>

    <!-- Right controls -->
    <div class="flex items-center gap-2">

      <!-- Language toggle -->
      <div class="hidden sm:flex rounded-md overflow-hidden border border-white/20 text-xs">
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
          <span class="text-sm text-white/90 max-w-24 truncate hidden sm:inline">{{ userName }}</span>
          <ChevronDown
            :size="14"
            class="text-white/50 transition-transform duration-150"
            :class="userMenuOpen ? 'rotate-180' : ''"
          />
        </button>

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
</template>

<style scoped>
.header-bg {
  background: rgb(var(--color-primary));
}

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
