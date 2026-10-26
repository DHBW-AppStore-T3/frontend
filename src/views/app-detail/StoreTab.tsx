import { useTranslation } from 'react-i18next'
import { AlertCircle, Clock, Globe, Lock, Send, Undo2 } from 'lucide-react'
import AppVersionStatusBadge from '@/components/ui/AppVersionStatusBadge'
import { formatDate } from '@/utils/format'
import { runtimeLabelKey } from './runtime'
import type { AppVersionApproval } from '@/types'
import type { AppDetail, BannerStatus } from './versionInfo'

export interface StoreTabProps {
  app: AppDetail
  banner: BannerStatus
  versionOptions: string[]
  approvalByVersion: Record<string, AppVersionApproval>
  /**
   * Owner or admin: the backend lets both submit, withdraw and resubmit a version
   * (`can_submit_app_version`), so the actions are shown to both.
   */
  canSubmitVersion: boolean
  /** Admins may make a deactivated app public again; nobody else. */
  isAdmin: boolean
  isTogglingPrivacy: boolean
  withdrawingVersion: string | null
  onTogglePrivacy: () => void
  onSubmitVersion: (version: string) => void
  onWithdrawVersion: (version: string) => void
}

const COMMIT_SHORT_LENGTH = 8
const PANEL = 'bg-surfaceMuted rounded-xl border border-borderSubtle p-5'
const PANEL_TITLE = 'text-sm font-semibold text-textMuted uppercase tracking-wide mb-4'
const LINK_ACTION = 'text-xs hover:underline flex items-center gap-1 disabled:opacity-50'

export default function StoreTab(props: StoreTabProps) {
  const { app, banner, versionOptions, approvalByVersion, canSubmitVersion, isAdmin } = props
  const { t } = useTranslation()
  const isPrivate = !!app.is_private
  const VisibilityIcon = isPrivate ? Lock : Globe
  // An admin deactivated the app; only an admin can make it public again.
  const lockedByAdmin = !!app.hidden_by_admin && !isAdmin

  const actionFor = (ver: string) => {
    const approval = approvalByVersion[ver]
    if (approval?.status === 'rejected') {
      return (
        <div className="space-y-1">
          <p className="text-xs text-danger italic">
            {t('AppsDetailView.rejectionReasonLabel')} {approval.rejection_reason || '–'}
          </p>
          {canSubmitVersion ? (
            <button
              type="button"
              onClick={() => props.onSubmitVersion(ver)}
              className={`${LINK_ACTION} text-info`}
            >
              <Send size={12} />
              {t('AppsDetailView.resubmitButton')}
            </button>
          ) : null}
        </div>
      )
    }
    if (approval?.status === 'pending' && canSubmitVersion) {
      return (
        <button
          type="button"
          onClick={() => props.onWithdrawVersion(ver)}
          disabled={props.withdrawingVersion === ver}
          className={`${LINK_ACTION} text-textMuted hover:text-danger`}
        >
          <Undo2 size={12} />
          {props.withdrawingVersion === ver ? '...' : t('AppsDetailView.withdrawButton')}
        </button>
      )
    }
    if (!approval && canSubmitVersion) {
      return (
        <button type="button" onClick={() => props.onSubmitVersion(ver)} className={`${LINK_ACTION} text-success`}>
          <Send size={12} />
          {t('AppsDetailView.submitButton')}
        </button>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Status banners */}
      {banner === 'no_submission' ? (
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-800">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <p className="text-sm">{t('AppsDetailView.bannerNoSubmission')}</p>
        </div>
      ) : banner === 'pending' ? (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4 text-orange-800">
          <Clock size={20} className="flex-shrink-0 mt-0.5" />
          <p className="text-sm">{t('AppsDetailView.bannerPending')}</p>
        </div>
      ) : null}

      {/* Visibility toggle */}
      <div className={PANEL}>
        <h3 className={PANEL_TITLE}>{t('AppsDetailView.storeVisibilityTitle')}</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${isPrivate ? 'bg-purple-100 text-purple-600' : 'bg-successTint text-success'}`}
            >
              <VisibilityIcon size={20} />
            </div>
            <div>
              <p className="font-medium text-textHeading">
                {isPrivate ? t('AppsDetailView.visibilityPrivate') : t('AppsDetailView.visibilityPublic')}
              </p>
              <p className="text-sm text-textMuted">
                {isPrivate ? t('AppsDetailView.visibilityPrivateDesc') : t('AppsDetailView.visibilityPublicDesc')}
              </p>
              {app.hidden_by_admin ? (
                <p className="text-sm text-danger" data-testid="hidden-by-admin">
                  {t('AppsDetailView.hiddenByAdmin')}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isPrivate}
            aria-label={t('AppsDetailView.storeVisibilityTitle')}
            onClick={props.onTogglePrivacy}
            disabled={props.isTogglingPrivacy || lockedByAdmin}
            title={lockedByAdmin ? t('AppsDetailView.hiddenByAdmin') : ''}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
              isPrivate ? 'bg-purple-500' : 'bg-success'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                isPrivate ? 'translate-x-0' : 'translate-x-5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Version approvals (public apps only) */}
      {!isPrivate ? (
        <div className={PANEL}>
          <h3 className={PANEL_TITLE}>{t('AppsDetailView.versionTableTitle')}</h3>

          {versionOptions.length === 0 ? (
            <div className="text-sm text-textFaint italic">{t('AppsDetailView.noVersionsYet')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borderSubtle text-left text-xs text-textMuted uppercase tracking-wide">
                    <th className="pb-2 pr-4">{t('AppsDetailView.versionTableVersion')}</th>
                    <th className="pb-2 pr-4">{t('AppsDetailView.versionTableStatus')}</th>
                    <th className="pb-2 pr-4">{t('AppsDetailView.versionTableRuntime')}</th>
                    <th className="pb-2 pr-4">{t('AppsDetailView.versionTableDate')}</th>
                    <th className="pb-2">{t('AppsDetailView.versionTableAction')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {versionOptions.map((ver) => {
                    const approval = approvalByVersion[ver]
                    return (
                      <tr key={ver} className="hover:bg-surfaceMuted transition-colors">
                        <td className="py-2.5 pr-4 font-mono text-textHeading">{ver}</td>
                        <td className="py-2.5 pr-4">
                          {approval ? (
                            <AppVersionStatusBadge status={approval.status} />
                          ) : (
                            <span className="text-textFaint text-xs">–</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-textMuted">
                          {approval ? (
                            <>
                              {t(runtimeLabelKey(approval.runtime ?? 'kubernetes'))}
                              {approval.commit_sha ? (
                                <span className="block font-mono text-textFaint" title={approval.commit_sha}>
                                  {approval.commit_sha.slice(0, COMMIT_SHORT_LENGTH)}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            '–'
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-textMuted text-xs">
                          {approval ? formatDate(approval.created_at) : '–'}
                        </td>
                        <td className="py-2.5">{actionFor(ver)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 text-sm text-purple-700">
          {t('AppsDetailView.privateAppStoreHint')}
        </div>
      )}
    </div>
  )
}
