export const SUPPORTED_LOCALES = ['de', 'en'] as const
export type SupportedLocale = typeof SUPPORTED_LOCALES[number]
export const DEFAULT_LOCALE: SupportedLocale = 'de'
export const FALLBACK_LOCALE: SupportedLocale = 'en'
const STORAGE_KEY = 'locale'

export function readSavedLocale(): SupportedLocale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return SUPPORTED_LOCALES.find(locale => locale === saved) ?? DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

export function saveLocale(locale: SupportedLocale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Third-party embeds may deny storage; the current session still switches.
  }
}
