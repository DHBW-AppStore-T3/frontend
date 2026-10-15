import { useTranslation } from 'react-i18next'
import { Check, X, RotateCcw } from 'lucide-react'
import AppVersionStatusBadge from '@/components/ui/AppVersionStatusBadge'
import { formatDate } from '@/utils/format'
import type { AppVersionApproval } from '@/types'

export interface VersionTableProps {
  approvals: AppVersionApproval[]
  /** ``"<appId>:<versionTag>"`` prefix check is done by the caller via ``isBusy``. */
  isBusy: (versionTag: string) => boolean
  onApprove: (versionTag: string) => void
  onReject: (versionTag: string) => void
  onRevoke: (versionTag: string) => void
}

const ACTION_BASE = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50'
const APPROVE_CLASS = `${ACTION_BASE} bg-successTint text-success border-success/30 hover:bg-successTint`
const REJECT_CLASS = `${ACTION_BASE} bg-dangerTint text-red-700 border-danger/30 hover:bg-dangerTint`
const REVOKE_CLASS = `${ACTION_BASE} bg-surfaceMuted text-textMuted border-borderSubtle hover:bg-gray-200`

const HEADER_CELL = 'py-2 text-xs font-semibold text-textMuted uppercase tracking-wide'

/** Version history of one app with the status-dependent admin actions. */
export default function VersionTable({ approvals, isBusy, onApprove, onReject, onRevoke }: VersionTableProps) {
  const { t } = useTranslation()

  const approveButton = (versionTag: string) => (
    <button type="button" className={APPROVE_CLASS} disabled={isBusy(versionTag)} onClick={() => onApprove(versionTag)}>
      <Check size={13} />
      {t('AdminAppsView.approveBtn')}
    </button>
  )

  return (
    <div className="px-4 pb-3">
      <table className="w-full text-sm">
        <thead className="border-b border-borderSubtle">
          <tr>
            <th className={`text-left px-2 ${HEADER_CELL}`}>{t('AdminAppsView.colVersion')}</th>
            <th className={`text-left px-4 ${HEADER_CELL}`}>{t('AdminAppsView.colStatus')}</th>
            <th className={`text-left px-4 ${HEADER_CELL}`}>{t('AdminAppsView.colDate')}</th>
            <th className={`text-right px-2 ${HEADER_CELL}`}>{t('AdminAppsView.colActions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {approvals.map((approval) => (
            <tr key={approval.approvalId} className="bg-white hover:bg-surfaceMuted transition-colors">
              <td className="py-3 px-2">
                <span className="font-mono text-textHeading bg-surfaceMuted px-2 py-0.5 rounded text-xs">
                  {approval.version_tag}
                </span>
              </td>
              <td className="py-3 px-4">
                <div className="space-y-1.5">
                  <AppVersionStatusBadge status={approval.status} />
                  {approval.notes ? (
                    <div className="flex items-start gap-1.5 max-w-xs">
                      <span className="text-xs font-medium text-textFaint shrink-0 mt-px">
                        {t('AdminAppsView.notesLabel')}
                      </span>
                      <span className="text-xs text-textMuted italic truncate" title={approval.notes}>
                        {approval.notes}
                      </span>
                    </div>
                  ) : null}
                  {approval.rejection_reason ? (
                    <div className="flex items-start gap-1.5 max-w-xs">
                      <span className="text-xs font-medium text-danger shrink-0 mt-px">
                        {t('AdminAppsView.rejectionLabel')}
                      </span>
                      <span className="text-xs text-danger italic truncate" title={approval.rejection_reason}>
                        {approval.rejection_reason}
                      </span>
                    </div>
                  ) : null}
                </div>
              </td>
              <td className="py-3 px-4 text-textMuted text-xs">{formatDate(approval.created_at)}</td>
              <td className="py-3 px-2">
                <div className="flex justify-end gap-2">
                  {approval.status === 'pending' ? (
                    <>
                      {approveButton(approval.version_tag)}
                      <button
                        type="button"
                        className={REJECT_CLASS}
                        disabled={isBusy(approval.version_tag)}
                        onClick={() => onReject(approval.version_tag)}
                      >
                        <X size={13} />
                        {t('AdminAppsView.rejectBtn')}
                      </button>
                    </>
                  ) : null}
                  {approval.status === 'approved' ? (
                    <button
                      type="button"
                      className={REVOKE_CLASS}
                      disabled={isBusy(approval.version_tag)}
                      onClick={() => onRevoke(approval.version_tag)}
                    >
                      <RotateCcw size={13} />
                      {t('AdminAppsView.revokeBtn')}
                    </button>
                  ) : null}
                  {approval.status === 'rejected' ? approveButton(approval.version_tag) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
