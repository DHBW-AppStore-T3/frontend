import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Cloud, ChevronRight, Plus } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useRole } from '@/composables/useRole'
import { useToast } from '@/composables/useToast'
import { saveLocale, SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/locale'
import { roleLabelKey } from '@/i18n/role-labels'
import type { UserWithCourse } from '@/types'
import PageHeader from '@/components/ui/PageHeader'
import BaseButton from '@/components/ui/BaseButton'
import './UserView.css'

export default function UserView() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const user = useAuthStore((s) => s.user) as UserWithCourse | null
  // OpenStack credentials only matter to staff deploying VM apps.
  const { isStaff } = useRole()

  const currentLocale: SupportedLocale = i18n.language === 'en' ? 'en' : 'de'
  // The draft follows the active language until the user picks something else.
  const [draft, setDraft] = useState<SupportedLocale | null>(null)
  const selectedLanguage = draft ?? currentLocale

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || ''

  function savePreferences(e: React.FormEvent) {
    e.preventDefault()
    void i18n.changeLanguage(selectedLanguage)
    saveLocale(selectedLanguage)
    setDraft(null)
    toast.success(t('workspace.preferencesSaved'))
  }

  const accountFields = [
    { label: t('auth.login.userLabel'), value: user?.username },
    { label: t('UserView.fields.role'), value: t(roleLabelKey(user?.role)) },
    { label: t('UserView.fields.course'), value: user?.course?.name },
    { label: t('UserView.fields.userId'), value: user?.userId },
    { label: t('UserView.fields.keycloakId'), value: user?.keycloak_id },
    {
      label: t('UserView.fields.registeredAt'),
      value: user?.created_at ? new Date(user.created_at).toLocaleDateString(i18n.language) : undefined,
    },
  ]

  return (
    <div className="app-page profile-page">
      <PageHeader
        title={t('workspace.personalInformation')}
        subtitle={t('workspace.profileSubtitle')}
      />
      {!user ? (
        <p className="text-textMuted">{t('UserView.loading')}</p>
      ) : (
        <>
          <form className="profile-form" onSubmit={savePreferences}>
            <label>
              {t('workspace.name')}
              <input value={displayName} readOnly autoComplete="name" />
            </label>
            <label>
              {t('UserView.fields.email')}
              <input value={user.email ?? ''} readOnly type="email" autoComplete="email" />
            </label>
            <p className="profile-hint">{t('workspace.accountManaged')}</p>
            <label>
              {t('auth.login.language')}
              <select
                value={selectedLanguage}
                onChange={(e) => setDraft(e.target.value as SupportedLocale)}
              >
                {SUPPORTED_LOCALES.map((language) => (
                  <option key={language} value={language}>
                    {t(`workspace.languages.${language}`)}
                  </option>
                ))}
              </select>
            </label>
            <BaseButton type="submit" className="self-start">
              <Plus size={16} />
              {t('workspace.save')}
            </BaseButton>
          </form>
          <details className="profile-account">
            <summary>{t('UserView.title')}</summary>
            <dl>
              {accountFields.map((field) => (
                <div key={field.label}>
                  <dt>{field.label}</dt>
                  <dd>{field.value || '–'}</dd>
                </div>
              ))}
            </dl>
          </details>
          {isStaff ? (
            <Link to="/user/openstack" className="ui-card profile-settings">
              <Cloud size={24} className="text-primary" />
              <span>
                <strong>{t('UserView.settings.openstackTitle')}</strong>
                <small>{t('UserView.settings.openstackHint')}</small>
              </span>
              <ChevronRight size={18} />
            </Link>
          ) : null}
        </>
      )}
    </div>
  )
}
