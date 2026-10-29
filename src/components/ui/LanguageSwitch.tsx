import { useTranslation } from 'react-i18next'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/locale'
import { switchLocale } from '@/i18n'

export default function LanguageSwitch() {
  const { i18n, t } = useTranslation()

  function selectLocale(value: SupportedLocale) {
    switchLocale(value)
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
