import { useTranslation } from 'react-i18next'
import { saveLocale, SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/locale'

export default function LanguageSwitch() {
  const { i18n, t } = useTranslation()

  function selectLocale(value: SupportedLocale) {
    void i18n.changeLanguage(value)
    saveLocale(value)
  }

  return (
    <div className="language-switch" role="group" aria-label={t('auth.login.language')}>
      {SUPPORTED_LOCALES.map((language) => (
        <button
          key={language}
          type="button"
          lang={language}
          aria-pressed={i18n.language === language}
          onClick={() => selectLocale(language)}
        >
          {language.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
