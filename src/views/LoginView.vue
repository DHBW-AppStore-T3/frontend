<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { LogIn } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth.store'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useTheme } from '@/theme/useTheme'

const institution = useTheme().brand.institution ?? 'DHBW'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// Get return URL from query params
const returnUrl = (route.query.returnUrl as string) || '/dashboard'

// Redirect to Keycloak login
const loginWithKeycloak = async () => {
  try {
    await authStore.login(returnUrl)
  } catch (err) {
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
    <p class="login-description">
      {{ $t('auth.login.keycloakInfo', { institution }) }}
    </p>

    <BaseButton variant="solid" class="login-button" @click="loginWithKeycloak">
      <LogIn aria-hidden="true" />
      {{ $t('auth.login.keycloakButton', { institution }) }}
    </BaseButton>

    <p class="login-help">
      {{ $t('auth.login.noAccount') }}
    </p>
  </div>
</template>

<style scoped>
.login-description {
  margin: 0 0 var(--auth-description-gap);
  color: var(--auth-muted);
  font-size: var(--auth-text-body);
  line-height: var(--auth-line-body);
}
.login-button {
  width: 100%;
  min-height: var(--auth-button-height);
  padding: var(--auth-button-padding-y) var(--auth-button-padding-x);
  font-size: var(--auth-text-control);
  line-height: var(--auth-line-body);
  border-radius: var(--auth-button-radius);
  background: var(--auth-accent);
  box-shadow: none;
}
.login-button svg { width: var(--auth-icon-size); height: var(--auth-icon-size); }
.login-button:hover { background: var(--auth-accent-hover); }
.login-help {
  margin: var(--auth-help-gap) 0 0;
  color: var(--auth-muted);
  font-size: var(--auth-text-caption);
  line-height: var(--auth-line-body);
}
</style>
