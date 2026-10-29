import i18next, { type i18n as I18nInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'

import { readSavedLocale, FALLBACK_LOCALE, saveLocale, type SupportedLocale } from './locale'

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
  // Empty on purpose: a locale file is loaded when its language is needed (issue 148),
  // see `loadLocale`. The first one is awaited in `bootstrap` before the first render.
  resources: {},
  interpolation: { prefix: '{', suffix: '}', escapeValue: false },
  returnNull: false,
  initImmediate: false,
  showSupportNotice: false,
})

// One chunk per language. Both files hold the same keys (tests/unit/i18n/locale-parity.spec.ts),
// so the fallback language does not have to be loaded next to the active one.
const loaders: Record<SupportedLocale, () => Promise<{ default: object }>> = {
  de: () => import('./locales/de'),
  en: () => import('./locales/en'),
}

const isLoaded = (locale: SupportedLocale) => i18n.hasResourceBundle(locale, 'translation')

/** Registers the messages of ``locale`` (once). */
export async function loadLocale(locale: SupportedLocale): Promise<void> {
  if (isLoaded(locale)) return
  const { default: messages } = await loaders[locale]()
  i18n.addResourceBundle(locale, 'translation', messages, true, true)
}

/** Loads the language the instance starts in; call it before the first render. */
export function loadActiveLocale(): Promise<void> {
  return loadLocale(readSavedLocale())
}

/**
 * Switches the language and remembers the choice. The messages are loaded first,
 * so the page never shows keys; a language that is already loaded switches at once.
 */
export function switchLocale(locale: SupportedLocale): void {
  saveLocale(locale)
  const apply = () => void i18n.changeLanguage(locale)
  if (isLoaded(locale)) apply()
  else void loadLocale(locale).then(apply)
}

export default i18n
