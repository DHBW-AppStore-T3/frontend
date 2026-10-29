import type { CSSProperties, ReactNode } from 'react'
import { Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Package, Layers, ShieldCheck, Settings, SquarePlay, Check } from 'lucide-react'
import { useTheme } from '@/theme/useTheme'
import { THEME_COLOR_KEYS } from '@/theme/types'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/locale'
import { switchLocale } from '@/i18n'
import '@/theme/auth.css'
import './AuthLayout.css'

const features = [
  { icon: Package, key: 'diverse' },
  { icon: Layers, key: 'preconfigured' },
  { icon: ShieldCheck, key: 'secure' },
]
const steps = [
  { icon: Settings, key: 'configure', complete: true },
  { icon: Layers, key: 'deploy', complete: true },
  { icon: SquarePlay, key: 'start', complete: false },
]

/** Layout shell; renders `children` or, as a route layout, the matched child route. */
export default function AuthLayout({ children }: { children?: ReactNode }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const theme = useTheme()
  const themeVars = Object.fromEntries(
    THEME_COLOR_KEYS.map((key) => [`--color-${key}`, theme.colors[key]]),
  ) as CSSProperties

  function changeLocale(lang: SupportedLocale) {
    switchLocale(lang)
  }

  // Translators define intentional line groups; no language-specific word parsing.
  const titleLeadLines = t('auth.hero.heading.lead').split('\n')
  const hasFixedTitleLines = titleLeadLines.length > 1

  return (
    <div className="auth-page" style={themeVars} lang={locale}>
      <div
        className="auth-backdrop"
        style={theme.loginBackground ? { backgroundImage: `url(${theme.loginBackground})` } : undefined}
        aria-hidden="true"
      />

      <svg className="auth-panel" viewBox="0 0 1672 941" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="auth-fold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className="auth-fold-stop" stopOpacity=".28" />
            <stop offset="1" className="auth-fold-stop" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="auth-panel-surface" d="M0 0H737L555 743Q548 765 568 781L800 941H0Z" />
        <path fill="url(#auth-fold)" d="M0 625L303 900Q317 914 320 941H0Z" />
      </svg>

      <div className="auth-content">
        <header className="auth-header">
          <div className="auth-brand">
            <div
              className="auth-logo-mark"
              role="img"
              aria-label={theme.brand.name}
              style={{ '--logo-mask-url': `url(${theme.authLogo?.src ?? theme.logo.src})` } as CSSProperties}
            />
            <span>{theme.brand.tagline}</span>
          </div>
          <div className="auth-language" role="group" aria-label={t('auth.login.language')}>
            {SUPPORTED_LOCALES.map((lang) => (
              <button
                key={lang}
                type="button"
                lang={lang}
                data-testid={`locale-${lang}`}
                aria-pressed={locale === lang}
                onClick={() => changeLocale(lang)}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </header>

        <main className="auth-main">
          <p className="auth-eyebrow">{t('auth.hero.eyebrow')}</p>
          <h1 className={`auth-title${hasFixedTitleLines ? ' auth-title--fixed-lines' : ''}`}>
            {titleLeadLines.map((line) => (
              <span key={line} className="auth-title-line">
                {line}
              </span>
            ))}
            <span className="auth-title-accent">{t('auth.hero.heading.accent')}</span>
          </h1>
          {children ?? <Outlet />}
        </main>

        <footer
          className="auth-features"
          style={{ '--auth-feature-count': features.length } as CSSProperties}
        >
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div key={feature.key} className="auth-feature">
                <Icon className="auth-icon" aria-hidden="true" />
                <span>{t(`auth.login.features.${feature.key}`)}</span>
              </div>
            )
          })}
        </footer>
      </div>

      {/* Decorative product illustration, not live deployment status. */}
      <div className="auth-workflow" aria-hidden="true">
        {steps.map((step) => {
          const Icon = step.icon
          return (
            <div key={step.key} className="auth-step">
              <Icon className="auth-icon" />
              <span>{t(`auth.hero.steps.${step.key}`)}</span>
              {step.complete ? <Check className="auth-icon auth-step-check" /> : <span className="auth-step-circle" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
