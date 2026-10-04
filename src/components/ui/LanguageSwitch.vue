<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { saveLocale, SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/locale'
const { locale, t } = useI18n()
function selectLocale(value: SupportedLocale) {
  locale.value = value
  saveLocale(value)
}
</script>

<template>
  <div class="language-switch" role="group" :aria-label="t('auth.login.language')">
    <button v-for="language in SUPPORTED_LOCALES" :key="language" type="button"
      :lang="language" :aria-pressed="locale === language" @click="selectLocale(language)">
      {{ language.toUpperCase() }}
    </button>
  </div>
</template>
