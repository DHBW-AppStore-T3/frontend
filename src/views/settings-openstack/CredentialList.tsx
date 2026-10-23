import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, CircleHelp, ShieldQuestion, Trash2, RefreshCw } from 'lucide-react'
import type { OpenStackCredential } from '@/types/openstack-credential'
import { credentialHealth, isDeletable } from './credentialStatus'

const DISPLAY_LOCALE = 'de-DE'
const CLOUDS_FILE_TOKEN = '\u0000file\u0000'

export interface CredentialListProps {
  /** null until the list was read once. */
  credentials: OpenStackCredential[] | null
  isLoading: boolean
  onRetest: (credential: OpenStackCredential) => void
  onDelete: (credential: OpenStackCredential) => void
}

const formatTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(DISPLAY_LOCALE) : null)

function HealthIcon({ credential }: { credential: OpenStackCredential }) {
  switch (credentialHealth(credential)) {
    case 'unverified':
      return <ShieldQuestion className="text-warning" size={22} />
    case 'failing':
      return <XCircle className="text-danger" size={22} />
    default:
      return <CheckCircle2 className="text-green-500" size={22} />
  }
}

function NoCredentials() {
  const { t } = useTranslation()
  // The hint embeds a styled file name: translate with a token, then split.
  const [before, after] = t('SettingsOpenStackView.status.noneHint', { file: CLOUDS_FILE_TOKEN }).split(CLOUDS_FILE_TOKEN)
  return (
    <div className="p-5 flex items-center gap-3">
      <CircleHelp className="text-textFaint" size={22} />
      <div>
        <div className="font-medium text-textHeading">{t('SettingsOpenStackView.status.noneTitle')}</div>
        <div className="text-sm text-textMuted">
          <span>
            {before}
            <code className="font-mono">clouds.yaml</code>
            {after}
          </span>
        </div>
      </div>
    </div>
  )
}

function CredentialRow({
  credential,
  isLoading,
  onRetest,
  onDelete,
}: { credential: OpenStackCredential } & Pick<CredentialListProps, 'isLoading' | 'onRetest' | 'onDelete'>) {
  const { t } = useTranslation()
  const id = credential.credentialId
  const lastChecked = formatTime(credential.last_validated_at)
  const deletable = isDeletable(credential)

  return (
    <li className="p-5 flex flex-wrap items-center justify-between gap-3" data-testid={`credential-${id}`}>
      <div className="flex items-center gap-3 min-w-0">
        <HealthIcon credential={credential} />
        <div className="min-w-0">
          <div className="font-medium text-textHeading truncate">
            {credential.project_name || credential.project_id || t('SettingsOpenStackView.status.unknownProject')}
            <span className="ml-2 text-xs text-textFaint font-mono">
              {credential.auth_type === 'password'
                ? t('SettingsOpenStackView.tabs.password')
                : t('SettingsOpenStackView.tabs.app')}
            </span>
          </div>
          <div className="text-sm text-textMuted">
            {!credential.project_verified ? (
              <span className="block text-warning" data-testid="credential-unverified">
                {t('SettingsOpenStackView.status.unverified')}
              </span>
            ) : lastChecked ? (
              <span>{t('SettingsOpenStackView.status.lastChecked', { time: lastChecked })}</span>
            ) : null}
            {credential.last_validation_error ? (
              <span className="block text-danger">{credential.last_validation_error}</span>
            ) : null}
            {!deletable ? (
              <span className="block">
                {t('SettingsOpenStackView.status.activeDeployments', { count: credential.active_deployments })}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="px-3 py-2 text-sm border rounded-md hover:bg-surfaceMuted flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid={`btn-retest-${id}`}
          onClick={() => onRetest(credential)}
          disabled={isLoading}
        >
          <RefreshCw size={16} /> {t('SettingsOpenStackView.status.retest')}
        </button>
        <button
          type="button"
          className="px-3 py-2 text-sm border rounded-md text-danger border-danger/30 hover:bg-dangerTint flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid={`btn-delete-${id}`}
          onClick={() => onDelete(credential)}
          disabled={isLoading || !deletable}
          title={!deletable ? t('SettingsOpenStackView.tooltips.lockedActiveDeployments') : ''}
        >
          <Trash2 size={16} /> {t('SettingsOpenStackView.status.delete')}
        </button>
      </div>
    </li>
  )
}

/** The stored credentials, one per OpenStack project. */
export default function CredentialList({ credentials, isLoading, onRetest, onDelete }: CredentialListProps) {
  const { t } = useTranslation()

  let body
  if (credentials === null) {
    body = <div className="p-5 text-textMuted text-sm">{t('SettingsOpenStackView.status.loading')}</div>
  } else if (credentials.length === 0) {
    body = <NoCredentials />
  } else {
    body = (
      <ul className="divide-y">
        {credentials.map((credential) => (
          <CredentialRow
            key={credential.credentialId}
            credential={credential}
            isLoading={isLoading}
            onRetest={onRetest}
            onDelete={onDelete}
          />
        ))}
      </ul>
    )
  }

  return (
    <div className="bg-white rounded-xl border mb-6" data-testid="credential-list">
      {body}
    </div>
  )
}
