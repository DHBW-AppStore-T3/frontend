import { createI18n } from 'vue-i18n'

import de from './locales/de'
import en from './locales/en'

// Runs at module import, before the app mounts. When the app is embedded in a
// third-party iframe (e.g. the Moodle LTI launch), the browser blocks storage
// access and localStorage.getItem throws SecurityError — an unguarded read here
// would abort the whole boot and leave a blank iframe.
function readSavedLocale(): string {
  try {
    return localStorage.getItem('locale') || 'de'
  } catch {
    return 'de'
  }
}

const savedLocale = readSavedLocale()

const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'en',
  messages: {
    de,
    en,
  },
})

export default i18n
