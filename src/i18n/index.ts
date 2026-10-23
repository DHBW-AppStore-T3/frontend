import i18next, { type i18n as I18nInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'

import de from './locales/de'
import en from './locales/en'

import { readSavedLocale, FALLBACK_LOCALE } from './locale'

// Single i18n instance, shared by components (via react-i18next) and by
// non-React code such as the router guards (`i18n.t(...)`).
//
// `{name}` interpolation is configured here so the locale files keep the
// message format they had under vue-i18n. `escapeValue` is off because React
// escapes text children itself; HTML messages go through `translateHtml`.
const i18n: I18nInstance = i18next.createInstance()

void i18n.use(initReactI18next).init({
  lng: readSavedLocale(),
  fallbackLng: FALLBACK_LOCALE,
  resources: {
    de: { translation: de },
    en: { translation: en },
  },
  interpolation: { prefix: '{', suffix: '}', escapeValue: false },
  returnNull: false,
  initImmediate: false,
  showSupportNotice: false,
})

export default i18n
