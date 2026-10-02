<script setup lang="ts">
import type { Component } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { useTheme } from '@/theme/useTheme'
import LanguageSwitch from '@/components/ui/LanguageSwitch.vue'
defineProps<{
  collapsed: boolean
  navItems: { to: string | RouteLocationRaw; label: string; icon: Component }[]
}>()
const emit = defineEmits<{ navigate: [] }>()
const { logo } = useTheme()
const route = useRoute()
const router = useRouter()
function isActive(to: string | RouteLocationRaw) {
  const path = router.resolve(to).path
  return path === '/' ? route.path === '/' || route.path === '/dashboard' : route.path === path || route.path.startsWith(`${path}/`)
}
</script>

<template>
  <aside class="app-sidebar" :class="{ 'app-sidebar--collapsed': collapsed }">
    <RouterLink to="/" class="sidebar-brand" @click="emit('navigate')">
      <span class="sidebar-brand-mark" :style="{ maskImage: `url(${logo.src})` }">
        <img :src="logo.src" :alt="logo.alt" />
      </span>
    </RouterLink>
    <nav class="sidebar-nav" :aria-label="$t('workspace.navigation')">
      <RouterLink v-for="item in navItems" :key="item.label" :to="item.to"
        class="nav-link" :class="{ 'nav-link-active': isActive(item.to) }" :title="collapsed ? $t(item.label) : undefined"
        @click="emit('navigate')">
        <component :is="item.icon" :size="19" :stroke-width="1.5" aria-hidden="true" />
        <span :class="{ 'sr-only': collapsed }">{{ $t(item.label) }}</span>
      </RouterLink>
    </nav>
    <div class="sidebar-footer"><LanguageSwitch /></div>
  </aside>
</template>
