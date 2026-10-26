/**
 * One hint under the header of the detail page, for members:
 * lost access, a failed deployment, or a polling connection that is down.
 * The owner view has the logs and the task card for these, so it gets nothing.
 */
import { useTranslation } from 'react-i18next'
import { AlertTriangle, WifiOff } from 'lucide-react'
import type { StatusPollingState } from './useDeploymentStatusPolling'

interface Props {
  status?: string
  pollingState: StatusPollingState
  isMemberView: boolean
}

export default function DeploymentStatusNotice({ status, pollingState, isMemberView }: Props) {
  const { t } = useTranslation()

  if (pollingState === 'forbidden') {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
      >
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <span>{t('DeploymentDetailView.statusPollingForbidden')}</span>
      </div>
    )
  }

  if (isMemberView && status === 'failed') {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <span>{t('DeploymentDetailView.statusFailedHint')}</span>
      </div>
    )
  }

  if (pollingState === 'degraded') {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
      >
        <WifiOff size={18} className="mt-0.5 shrink-0" />
        <span>{t('DeploymentDetailView.statusPollingDegraded')}</span>
      </div>
    )
  }

  return null
}
