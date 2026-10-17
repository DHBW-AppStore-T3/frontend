import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, CircleHelp, Trash2, RefreshCw } from 'lucide-react'

export interface CredentialStatusCardProps {
  isLoading: boolean
  hasCredential: boolean
  isValid: boolean
  lastError: string | null
  /** Pre-formatted time of the last validation, if any. */
  lastValidated: string | null
  isLocked: boolean
  onRetest: () => void
  onDelete: () => void
}

const CLOUDS_FILE_TOKEN = '\u0000file\u0000'

export default function CredentialStatusCard(props: CredentialStatusCardProps) {
  const { isLoading, hasCredential, isValid, lastError, lastValidated, isLocked, onRetest, onDelete } = props
  const { t } = useTranslation()

  // The hint embeds a styled file name: translate with a token, then split.
  const [hintBefore, hintAfter] = t('SettingsOpenStackView.status.noneHint', { file: CLOUDS_FILE_TOKEN }).split(
    CLOUDS_FILE_TOKEN,
  )

  let body
  if (isLoading) {
    body = <div className="text-textMuted text-sm">{t('SettingsOpenStackView.status.loading')}</div>
  } else if (!hasCredential) {
    body = (
      <div className="flex items-center gap-3">
        <CircleHelp className="text-textFaint" size={22} />
        <div>
          <div className="font-medium text-textHeading">{t('SettingsOpenStackView.status.noneTitle')}</div>
          <div className="text-sm text-textMuted">
            <span>
              {hintBefore}
              <code className="font-mono">clouds.yaml</code>
              {hintAfter}
            </span>
          </div>
        </div>
      </div>
    )
  } else {
    const healthy = isValid && !lastError
    body = (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {healthy ? (
            <CheckCircle2 className="text-green-500" size={22} />
          ) : (
            <XCircle className="text-danger" size={22} />
          )}
          <div>
            <div className="font-medium text-textHeading">
              {healthy ? t('SettingsOpenStackView.status.valid') : t('SettingsOpenStackView.status.invalid')}
            </div>
            <div className="text-sm text-textMuted">
              {lastValidated ? (
                <span>{t('SettingsOpenStackView.status.lastChecked', { time: lastValidated })}</span>
              ) : null}
              {lastError ? <span className="block text-danger">{lastError}</span> : null}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-2 text-sm border rounded-md hover:bg-surfaceMuted flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="btn-retest"
            onClick={onRetest}
            disabled={isLoading}
          >
            <RefreshCw size={16} /> {t('SettingsOpenStackView.status.retest')}
          </button>
          <button
            type="button"
            className="px-3 py-2 text-sm border rounded-md text-danger border-danger/30 hover:bg-dangerTint flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="btn-delete"
            onClick={onDelete}
            disabled={isLoading || isLocked}
            title={isLocked ? t('SettingsOpenStackView.tooltips.lockedActiveDeployments') : ''}
          >
            <Trash2 size={16} /> {t('SettingsOpenStackView.status.delete')}
          </button>
        </div>
      </div>
    )
  }

  return <div className="bg-white rounded-xl border p-5 mb-6">{body}</div>
}
