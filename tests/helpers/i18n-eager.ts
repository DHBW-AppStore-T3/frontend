// Specs import the app's i18n as `@/i18n` (see the alias in vitest.config.ts) and
// use German and English synchronously. The app registers one language lazily
// (#148); here both are registered up front. Only specs that import `@/i18n` get
// the app instance, so the key-echo specs elsewhere are unaffected.
import i18n from '../../src/i18n/index'
import de from '../../src/i18n/locales/de'
import en from '../../src/i18n/locales/en'

i18n.addResourceBundle('de', 'translation', de, true, true)
i18n.addResourceBundle('en', 'translation', en, true, true)

export * from '../../src/i18n/index'
export { default } from '../../src/i18n/index'
