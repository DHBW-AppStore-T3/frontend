<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Cloud, ChevronRight, Plus } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import { saveLocale, SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/locale'
import { roleLabelKey } from '@/i18n/role-labels'
import type { UserWithCourse } from '@/types'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
const auth = useAuthStore()
const toast = useToast()
const { t, locale } = useI18n()
const user = computed(() => auth.user as UserWithCourse | null)
const displayName = computed(() => [user.value?.firstName, user.value?.lastName].filter(Boolean).join(' ') || user.value?.username || '')
const selectedLanguage = ref<SupportedLocale>(locale.value === 'en' ? 'en' : 'de')
watch(locale, value => { selectedLanguage.value = value === 'en' ? 'en' : 'de' })
function savePreferences() {
  locale.value = selectedLanguage.value
  saveLocale(selectedLanguage.value)
  toast.success(t('workspace.preferencesSaved'))
}
const accountFields = computed(() => [
  { label: t('auth.login.userLabel'), value: user.value?.username },
  { label: t('UserView.fields.role'), value: t(roleLabelKey(user.value?.role)) },
  { label: t('UserView.fields.course'), value: user.value?.course?.name },
  { label: t('UserView.fields.userId'), value: user.value?.userId },
  { label: t('UserView.fields.keycloakId'), value: user.value?.keycloak_id },
  { label: t('UserView.fields.registeredAt'), value: user.value?.created_at ? new Date(user.value.created_at).toLocaleDateString(locale.value) : undefined },
])
</script>

<template>
  <div class="app-page profile-page">
    <PageHeader :eyebrow="t('workspace.profile')" :title="t('workspace.personalInformation')" :subtitle="t('workspace.profileSubtitle')" />
    <p v-if="!user" class="text-textMuted">{{ t('UserView.loading') }}</p>
    <template v-else>
      <form class="profile-form" @submit.prevent="savePreferences">
        <label>{{ t('workspace.name') }}<input :value="displayName" readonly autocomplete="name" /></label>
        <label>{{ t('UserView.fields.email') }}<input :value="user.email ?? ''" readonly type="email" autocomplete="email" /></label>
        <p class="profile-hint">{{ t('workspace.accountManaged') }}</p>
        <label>{{ t('auth.login.language') }}
          <select v-model="selectedLanguage"><option v-for="language in SUPPORTED_LOCALES" :key="language" :value="language">{{ t(`workspace.languages.${language}`) }}</option></select>
        </label>
        <BaseButton type="submit" class="self-start"><Plus :size="16" />{{ t('workspace.save') }}</BaseButton>
      </form>
      <details class="profile-account">
        <summary>{{ t('UserView.title') }}</summary>
        <dl><div v-for="field in accountFields" :key="field.label"><dt>{{ field.label }}</dt><dd>{{ field.value || '–' }}</dd></div></dl>
      </details>
      <RouterLink to="/user/openstack" class="ui-card profile-settings">
        <Cloud :size="24" class="text-primary" /><span><strong>{{ t('UserView.settings.openstackTitle') }}</strong><small>{{ t('UserView.settings.openstackHint') }}</small></span><ChevronRight :size="18" />
      </RouterLink>
    </template>
  </div>
</template>

<style scoped>
.profile-page { max-width: 760px; }
.profile-form { display: flex; flex-direction: column; gap: 22px; max-width: 480px; }
.profile-form label { display: grid; gap: 8px; color: rgb(var(--color-text-heading)); font-size: 13px; font-weight: 600; }
.profile-form input, .profile-form select { width: 100%; padding: 11px 12px; font-weight: 400; }
.profile-hint { font-size: 12px; color: rgb(var(--color-text-muted)); margin-top: -10px; }
.profile-account { margin: 36px 0 24px; color: rgb(var(--color-text-muted)); }
.profile-account summary { cursor: pointer; font-size: 13px; }
.profile-account dl { display: grid; gap: 14px; margin-top: 20px; }
.profile-account dl div { display: flex; justify-content: space-between; gap: 20px; }
.profile-account dd { overflow-wrap: anywhere; text-align: right; }
.profile-settings { display: flex; align-items: center; gap: 16px; }
.profile-settings span { flex: 1; display: grid; gap: 4px; }
.profile-settings small { color: rgb(var(--color-text-muted)); }
</style>
