import { createI18n } from 'vue-i18n'

import de from './locales/de'
import en from './locales/en'

import { readSavedLocale, FALLBACK_LOCALE } from './locale'

const i18n = createI18n({
  legacy: false,
  locale: readSavedLocale(),
  fallbackLocale: FALLBACK_LOCALE,
  messages: {
    de,
    en,
  },
})

export default i18n
