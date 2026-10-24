import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { KeyRound } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import { useOpenStackCredentialsStore } from '@/stores/openstack-credentials.store'
import { useToastStore } from '@/stores/toast.store'
import { parseCloudsYaml, CloudsYamlError } from '@/utils/clouds-yaml'
import type { OpenStackCredential } from '@/types/openstack-credential'
import {
  emptyAppForm,
  emptyPasswordForm,
  buildPayload,
  formsFromYaml,
  type AppCredentialForm,
  type CredentialTab,
  type FormsState,
  type PasswordCredentialForm,
} from './settings-openstack/credentialForm'
import { isDeletable, safeAppPath } from './settings-openstack/credentialStatus'
import CredentialList from './settings-openstack/CredentialList'
import YamlDropZone from './settings-openstack/YamlDropZone'
import { AppCredentialFields, PasswordCredentialFields } from './settings-openstack/CredentialFields'

export default function SettingsOpenStackView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const toast = useToastStore.getState()

  const credentials = useOpenStackCredentialsStore((s) => s.credentials)
  const isLoading = useOpenStackCredentialsStore((s) => s.loading)

  const [tab, setTab] = useState<CredentialTab>('app')
  const [appForm, setAppForm] = useState<AppCredentialForm>(emptyAppForm)
  const [passwordForm, setPasswordForm] = useState<PasswordCredentialForm>(emptyPasswordForm)

  const applyForms = (forms: FormsState) => {
    setTab(forms.tab)
    setAppForm(forms.app)
    setPasswordForm(forms.password)
  }

  const clearSecrets = () => {
    setAppForm((f) => ({ ...f, identifier: '', secret: '' }))
    setPasswordForm((f) => ({ ...f, secret: '' }))
  }

  useEffect(() => {
    void useOpenStackCredentialsStore.getState().fetch()
  }, [])

  // The store records failures in `error`; surface them as a toast.
  const reportStoreError = () => {
    const { error } = useOpenStackCredentialsStore.getState()
    if (error) toast.error(error)
  }

  const returnToWizardIfRequested = () => {
    const next = safeAppPath(params.get('next'))
    if (next) navigate(next)
  }

  // Keystone checks the credential before anything is stored and names its
  // project; saving another one for the same project replaces it (that is
  // how a secret is rotated).
  const handleSave = async () => {
    const payload = buildPayload(tab, appForm, passwordForm)
    if (!payload) {
      toast.error(t('SettingsOpenStackView.errors.missingFields'))
      return
    }
    try {
      const saved = await useOpenStackCredentialsStore.getState().save(payload)
      toast.success(
        t('SettingsOpenStackView.toasts.saveSuccess', { project: saved.project_name || saved.project_id }),
      )
      clearSecrets()
      returnToWizardIfRequested()
    } catch {
      reportStoreError()
    }
  }

  const handleTest = async (credential: OpenStackCredential) => {
    try {
      const checked = await useOpenStackCredentialsStore.getState().test(credential.credentialId)
      if (checked.last_validation_error) {
        toast.error(t('SettingsOpenStackView.errors.validationFailed', { error: checked.last_validation_error }))
      } else {
        toast.success(t('SettingsOpenStackView.toasts.credentialsValid'))
      }
    } catch {
      reportStoreError()
    }
  }

  const handleDelete = async (credential: OpenStackCredential) => {
    if (!isDeletable(credential)) {
      toast.warning(
        t('SettingsOpenStackView.errors.lockedActiveDeployments', { count: credential.active_deployments }),
      )
      return
    }
    const project = credential.project_name || credential.project_id || ''
    if (!window.confirm(t('SettingsOpenStackView.confirmDelete', { project }))) return
    try {
      await useOpenStackCredentialsStore.getState().remove(credential.credentialId)
      toast.success(t('SettingsOpenStackView.status.deleteSuccess'))
    } catch {
      reportStoreError()
    }
  }

  const importYamlFile = async (file: File) => {
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

  const tabClass = (name: CredentialTab) =>
    `flex-1 px-4 py-3 text-sm font-medium transition-colors ${
      tab === name ? 'text-primary border-b-2 border-primary' : 'text-textMuted hover:text-textMuted'
    }`

  return (
    <div className="app-page max-w-4xl">
      <PageHeader
        title={t('SettingsOpenStackView.title')}
        subtitle={t('SettingsOpenStackView.intro')}
      />

      {/* Only VM apps (the Windows desktop) need a credential; pod apps run without. */}
      <p className="text-sm text-textMuted mb-6">{t('SettingsOpenStackView.vmOnlyHint')}</p>

      <CredentialList
        credentials={credentials}
        isLoading={isLoading}
        onRetest={(credential) => void handleTest(credential)}
        onDelete={(credential) => void handleDelete(credential)}
      />

      <h2 className="text-lg font-semibold text-textHeading mb-3">{t('SettingsOpenStackView.addTitle')}</h2>

      <YamlDropZone
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
          <AppCredentialFields form={appForm} onChange={setAppForm} />
        ) : (
          <PasswordCredentialFields form={passwordForm} onChange={setPasswordForm} />
        )}

        <div className="px-6 pb-6 flex justify-end">
          <button
            type="button"
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={isLoading}
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
