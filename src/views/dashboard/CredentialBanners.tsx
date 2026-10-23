import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import CredentialMissingBanner from '@/components/CredentialMissingBanner'
import {
  useOpenStackCredentialsStore,
  selectUnverifiedCredentials,
  selectFailingCredentials,
} from '@/stores/openstack-credentials.store'
import { paths } from '@/router/paths'

/**
 * Banners only about credentials that exist and need attention. Not having
 * one is fine: only VM apps (the Windows desktop) need it.
 */
export default function CredentialBanners() {
  const { t } = useTranslation()
  const unverified = useOpenStackCredentialsStore(useShallow(selectUnverifiedCredentials))
  const failing = useOpenStackCredentialsStore(useShallow(selectFailingCredentials))

  if (unverified.length > 0) {
    return (
      <CredentialMissingBanner
        variant="warning"
        title={t('banners.credentialsUnverified.title')}
        message={t('banners.credentialsUnverified.message', { count: unverified.length })}
        cta={t('banners.credentialsUnverified.cta')}
        ctaTo={paths.userOpenStack}
      />
    )
  }
  if (failing.length > 0) {
    return (
      <CredentialMissingBanner
        variant="error"
        title={t('banners.credentialsInvalid.title')}
        message={failing[0]?.last_validation_error ?? ''}
        cta={t('banners.credentialsInvalid.cta')}
        ctaTo={paths.userOpenStack}
      />
    )
  }
  return null
}
