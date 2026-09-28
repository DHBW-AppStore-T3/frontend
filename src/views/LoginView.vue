<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { LogIn } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth.store'
import BaseButton from '@/components/ui/BaseButton.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// Get return URL from query params
const returnUrl = (route.query.returnUrl as string) || '/dashboard'

// Redirect to Keycloak login
const loginWithKeycloak = async () => {
  try {
    await authStore.login(returnUrl)
  } catch (err: any) {
    console.error('Login redirect failed:', err)
  }
}

// Auto-redirect if already authenticated
onMounted(() => {
  if (authStore.isAuthenticated) {
    router.push(returnUrl)
  }
})
</script>

<template>
  <div>
    <p class="text-body text-textMuted mb-8 max-w-md">
      {{ $t('auth.login.keycloakInfo') }}
    </p>

    <BaseButton variant="primary" @click="loginWithKeycloak">
      <LogIn :size="20" />
      {{ $t('auth.login.keycloakButton') }}
    </BaseButton>

    <p class="mt-6 text-caption text-textMuted">
      {{ $t('auth.login.noAccount') }}
    </p>
  </div>
</template>
