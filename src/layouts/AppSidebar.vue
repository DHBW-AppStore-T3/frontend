<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, type Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { PanelLeftOpen } from 'lucide-vue-next'
import { useTheme } from '@/theme/useTheme'
import Drawer from '@/components/ui/Drawer.vue'

const props = defineProps<{
  collapsed: boolean
  navItems: { to: string | RouteLocationRaw; label: string; icon: Component }[]
  mobileOpen: boolean
}>()
const emit = defineEmits<{
  (e: 'update:collapsed', value: boolean): void
  (e: 'close-mobile'): void
}>()

const { logo } = useTheme()

const MOBILE_BREAKPOINT = 768
const isMobile = ref(window.innerWidth < MOBILE_BREAKPOINT)
function updateIsMobile() {
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT
}
onMounted(() => window.addEventListener('resize', updateIsMobile))
onBeforeUnmount(() => window.removeEventListener('resize', updateIsMobile))

defineExpose({ isMobile })
</script>

<template>
  <Drawer v-if="isMobile" :show="mobileOpen" side="left" @close="emit('close-mobile')">
    <aside class="sidebar-bg flex flex-col h-full w-full">
      <div class="h-16 flex items-center border-b border-white/10 px-3" style="overflow: visible;">
        <RouterLink to="/" class="block" style="height: 48px; width: 100%; overflow: visible;" @click="emit('close-mobile')">
          <img :src="logo.src" :alt="logo.alt" :style="{ position: 'relative', zIndex: 30, height: `${logo.height}px`, marginTop: `${logo.offsetY}px`, marginLeft: `${logo.offsetX}px`, maxWidth: 'none' }" />
        </RouterLink>
      </div>
      <nav class="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        <RouterLink
          v-for="item in navItems"
          :key="item.label"
          :to="item.to"
          class="nav-link group"
          active-class="nav-link-active"
          @click="emit('close-mobile')"
        >
          <span class="nav-indicator" />
          <component :is="item.icon" :size="21" class="flex-shrink-0 opacity-70 group-[.nav-link-active]:opacity-100" />
          <span class="transition-opacity duration-150 whitespace-nowrap">{{ $t(item.label) }}</span>
        </RouterLink>
      </nav>
    </aside>
  </Drawer>

  <aside
    v-else
    class="sidebar-bg flex flex-col h-full flex-shrink-0 transition-colors duration-200"
    :class="collapsed ? 'w-16' : 'w-60'"
  >
    <div class="h-16 flex items-center border-b border-white/10 px-3" style="overflow: visible;">
      <RouterLink to="/" class="block" style="height: 48px; width: 100%; overflow: visible;">
        <img :src="logo.src" :alt="logo.alt" :style="{ position: 'relative', zIndex: 30, height: `${logo.height}px`, marginTop: `${logo.offsetY}px`, marginLeft: `${logo.offsetX}px`, maxWidth: 'none' }" />
      </RouterLink>
    </div>

    <div v-if="collapsed" class="px-2 py-2 border-b border-white/5">
      <button
        @click="emit('update:collapsed', false)"
        class="sidebar-toggle-btn"
        aria-label="Open sidebar"
      >
        <PanelLeftOpen :size="18" />
      </button>
    </div>

    <nav class="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
      <RouterLink
        v-for="item in navItems"
        :key="item.label"
        :to="item.to"
        class="nav-link group"
        :class="collapsed ? 'nav-link-collapsed' : ''"
        active-class="nav-link-active"
      >
        <span class="nav-indicator" />
        <component :is="item.icon" :size="21" class="flex-shrink-0 opacity-70 group-[.nav-link-active]:opacity-100" />
        <span
          v-if="!collapsed"
          class="transition-opacity duration-150 whitespace-nowrap"
        >{{ $t(item.label) }}</span>
        <span v-if="collapsed" class="nav-tooltip">{{ $t(item.label) }}</span>
      </RouterLink>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar-bg {
  background: linear-gradient(180deg, rgb(var(--color-primary)) 0%, rgb(var(--color-primary-deep)) 100%);
}

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

.nav-link-collapsed {
  padding: 13px;
  justify-content: center;
}

.nav-indicator {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%) scaleY(0);
  width: 3px;
  height: 60%;
  background: rgb(var(--color-brand-indicator));
  border-radius: 0 2px 2px 0;
  transition: transform 150ms ease;
}

.nav-link-active .nav-indicator {
  transform: translateY(-50%) scaleY(1);
}

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

.w-16 > .px-2 > .sidebar-toggle-btn,
.w-16 > .px-2 > .sidebar-toggle-btn > * {
  margin-left: auto;
  margin-right: auto;
  display: block;
}

.sidebar-bg.w-16 nav {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.sidebar-bg.w-16 nav::-webkit-scrollbar {
  width: 0;
  height: 0;
}
</style>
