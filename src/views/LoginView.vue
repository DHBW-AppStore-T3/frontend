<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { LogIn } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth.store'

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
    <h2 class="text-2xl font-bold text-center mb-6 text-textHeading">
      {{ $t('auth.login.title') }}
    </h2>

    <!-- Info Text -->
    <div class="mb-6 text-center text-textMuted">
      <p>{{ $t('auth.login.keycloakInfo') }}</p>
    </div>

    <!-- Keycloak Login Button -->
    <button
      @click="loginWithKeycloak"
      type="button"
      class="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition"
    >
      <LogIn :size="20" />
      {{ $t('auth.login.keycloakButton') }}
    </button>

    <!-- Info about registration -->
    <div class="mt-6 text-center text-sm text-textMuted">
      <p>{{ $t('auth.login.noAccount') }}</p>
    </div>
  </div>
</template>
