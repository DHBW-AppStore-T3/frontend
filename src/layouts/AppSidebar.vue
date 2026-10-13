<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, type Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import Drawer from '@/components/ui/Drawer.vue'
import SidebarNavigation from './SidebarNavigation.vue'
defineProps<{
  collapsed: boolean
  navItems: { to: string | RouteLocationRaw; label: string; icon: Component }[]
  mobileOpen: boolean
}>()
const emit = defineEmits<{
  'update:collapsed': [value: boolean]
  'close-mobile': []
}>()
const isMobile = ref(window.innerWidth < 768)
function updateIsMobile() { isMobile.value = window.innerWidth < 768 }
onMounted(() => window.addEventListener('resize', updateIsMobile))
onBeforeUnmount(() => window.removeEventListener('resize', updateIsMobile))
defineExpose({ isMobile })
</script>

<template>
  <Drawer v-if="isMobile" :show="mobileOpen" side="left" @close="emit('close-mobile')">
    <SidebarNavigation :collapsed="false" :nav-items="navItems" @navigate="emit('close-mobile')" />
  </Drawer>
  <SidebarNavigation v-else :collapsed="collapsed" :nav-items="navItems" />
</template>
