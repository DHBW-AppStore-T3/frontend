import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { KeyRound } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import CredentialMissingBanner from '@/components/CredentialMissingBanner'
import {
  useOpenStackCredentialsStore,
  selectHasCredential,
  selectIsValidated,
  selectLastError,
  selectIsLocked,
  selectActiveDeployments,
} from '@/stores/openstack-credentials.store'
import { useToastStore } from '@/stores/toast.store'
import { parseCloudsYaml, CloudsYamlError } from '@/utils/clouds-yaml'
import { paths } from '@/router/paths'
import {
  emptyAppForm,
  emptyPasswordForm,
  buildPayload,
  formsFromStatus,
  formsFromYaml,
  type AppCredentialForm,
  type CredentialTab,
  type FormsState,
  type PasswordCredentialForm,
} from './settings-openstack/credentialForm'
import CredentialStatusCard from './settings-openstack/CredentialStatusCard'
import YamlDropZone from './settings-openstack/YamlDropZone'
import { AppCredentialFields, PasswordCredentialFields } from './settings-openstack/CredentialFields'

const DISPLAY_LOCALE = 'de-DE'

export default function SettingsOpenStackView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const toast = useToastStore.getState()

  const status = useOpenStackCredentialsStore((s) => s.status)
  const isLoading = useOpenStackCredentialsStore((s) => s.loading)
  const hasCredential = useOpenStackCredentialsStore(selectHasCredential)
  const isValidated = useOpenStackCredentialsStore(selectIsValidated)
  const lastError = useOpenStackCredentialsStore(selectLastError)
  const isLocked = useOpenStackCredentialsStore(selectIsLocked)
  const activeDeployments = useOpenStackCredentialsStore(selectActiveDeployments)

  const [tab, setTab] = useState<CredentialTab>('app')
  const [appForm, setAppForm] = useState<AppCredentialForm>(emptyAppForm)
  const [passwordForm, setPasswordForm] = useState<PasswordCredentialForm>(emptyPasswordForm)

  const applyForms = (forms: FormsState) => {
    setTab(forms.tab)
    setAppForm(forms.app)
    setPasswordForm(forms.password)
  }

  const clearSecrets = () => {
    setAppForm((f) => ({ ...f, secret: '' }))
    setPasswordForm((f) => ({ ...f, secret: '' }))
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await useOpenStackCredentialsStore.getState().fetch()
      const loaded = useOpenStackCredentialsStore.getState().status
      // Pre-fill known non-secret fields if credentials exist.
      if (!cancelled && loaded?.has_credential) applyForms(formsFromStatus(loaded))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const warnIfLocked = (): boolean => {
    if (!isLocked) return false
    toast.warning(t('SettingsOpenStackView.errors.lockedActiveDeployments', { count: activeDeployments }))
    return true
  }

  // The store records failures in ``error``; surface them as a toast.
  const reportStoreError = () => {
    const { error } = useOpenStackCredentialsStore.getState()
    if (error) toast.error(error)
  }

  const returnToWizardIfRequested = () => {
    const next = params.get('next')
    if (next) navigate(next)
  }

  const handleSave = async () => {
    if (warnIfLocked()) return
    const payload = buildPayload(tab, appForm, passwordForm)
    if (!payload) {
      toast.error(t('SettingsOpenStackView.errors.missingFields'))
      return
    }
    try {
      await useOpenStackCredentialsStore.getState().save(payload)
      const validationError = selectLastError(useOpenStackCredentialsStore.getState())
      if (validationError) {
        toast.warning(t('SettingsOpenStackView.errors.validationFailedSaved', { error: validationError }))
      } else {
        toast.success(t('SettingsOpenStackView.toasts.saveSuccess'))
        returnToWizardIfRequested()
      }
      clearSecrets()
    } catch {
      reportStoreError()
    }
  }

  const handleTest = async () => {
    try {
      await useOpenStackCredentialsStore.getState().test()
      const validationError = selectLastError(useOpenStackCredentialsStore.getState())
      if (validationError) {
        toast.error(t('SettingsOpenStackView.errors.validationFailed', { error: validationError }))
      } else {
        toast.success(t('SettingsOpenStackView.toasts.credentialsValid'))
      }
    } catch {
      reportStoreError()
    }
  }

  const handleDelete = async () => {
    if (warnIfLocked()) return
    if (!window.confirm(t('SettingsOpenStackView.confirmDelete'))) return
    try {
      await useOpenStackCredentialsStore.getState().remove()
      toast.success(t('SettingsOpenStackView.status.deleteSuccess'))
      clearSecrets()
    } catch {
      reportStoreError()
    }
  }

  const importYamlFile = async (file: File) => {
    if (warnIfLocked()) return

    let text: string
    try {
      text = await file.text()
    } catch (err) {
      console.error('Failed to read clouds.yaml file:', err)
      toast.error(t('SettingsOpenStackView.fileReadError'))
      return
    }
    if (!text.trim()) {
      toast.error(t('SettingsOpenStackView.fileEmpty'))
      return
    }

    try {
      applyForms(formsFromYaml(parseCloudsYaml(text)))
    } catch (err) {
      console.error('clouds.yaml parse error:', err)
      toast.error(err instanceof CloudsYamlError ? err.message : t('SettingsOpenStackView.cloudsYamlError'))
      return
    }
    toast.success(t('SettingsOpenStackView.cloudsYamlImported'))
  }

  const lastValidated = status?.last_validated_at
    ? new Date(status.last_validated_at).toLocaleString(DISPLAY_LOCALE)
    : null

  const tabClass = (name: CredentialTab) =>
    `flex-1 px-4 py-3 text-sm font-medium transition-colors ${
      tab === name ? 'text-primary border-b-2 border-primary' : 'text-textMuted hover:text-textMuted'
    }`

  return (
    <div className="app-page max-w-4xl">
      <PageHeader
        eyebrow={t('UserView.settings.title')}
        title={t('SettingsOpenStackView.title')}
        subtitle={t('SettingsOpenStackView.intro')}
      />

      {isLocked ? (
        <div className="mb-6">
          <CredentialMissingBanner
            variant="lock"
            title={t('SettingsOpenStackView.lockBanner.title')}
            message={t('SettingsOpenStackView.lockBanner.message', { count: activeDeployments })}
            cta={t('SettingsOpenStackView.lockBanner.cta')}
            ctaTo={paths.deployments}
          />
        </div>
      ) : null}

      <CredentialStatusCard
        isLoading={isLoading}
        hasCredential={hasCredential}
        isValid={isValidated}
        lastError={lastError}
        lastValidated={lastValidated}
        isLocked={isLocked}
        onRetest={() => void handleTest()}
        onDelete={() => void handleDelete()}
      />

      <YamlDropZone
        disabled={isLocked}
        onFile={(file) => void importYamlFile(file)}
        onMissingFile={() => toast.error(t('SettingsOpenStackView.dropNoFile'))}
      />

      <div className="bg-white rounded-xl border">
        <div className="flex border-b">
          <button type="button" className={tabClass('app')} data-testid="tab-app" onClick={() => setTab('app')}>
            {t('SettingsOpenStackView.tabs.app')}
            <span className="ml-2 text-xs text-success">{t('SettingsOpenStackView.tabs.appRecommended')}</span>
          </button>
          <button
            type="button"
            className={tabClass('password')}
            data-testid="tab-password"
            onClick={() => setTab('password')}
          >
            {t('SettingsOpenStackView.tabs.password')}
          </button>
        </div>

        {tab === 'app' ? (
          <AppCredentialFields form={appForm} onChange={setAppForm} disabled={isLocked} />
        ) : (
          <PasswordCredentialFields form={passwordForm} onChange={setPasswordForm} disabled={isLocked} />
        )}

        <div className="px-6 pb-6 flex justify-end">
          <button
            type="button"
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={isLoading || isLocked}
            title={isLocked ? t('SettingsOpenStackView.tooltips.lockedActiveDeployments') : ''}
            data-testid="btn-save"
            onClick={() => void handleSave()}
          >
            <KeyRound size={16} />
            {t('SettingsOpenStackView.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
