import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Inbox } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import EntityListState from '@/components/ui/EntityListState'
import { useToast } from '@/composables/useToast'
import AppApprovalRow from './admin-apps/AppApprovalRow'
import ReasonModal from './admin-apps/ReasonModal'
import { useApprovalQueue } from './admin-apps/useApprovalQueue'

interface ModalTarget {
  appId: string
  versionTag: string
}

export default function AdminAppsView() {
  const { t } = useTranslation()
  const filterLabelId = useId()
  const toast = useToast()
  const queue = useApprovalQueue({ onLoadError: () => toast.error(t('AdminAppsView.loadError')) })

  const [onlyWithSubmissions, setOnlyWithSubmissions] = useState(true)
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ModalTarget | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<ModalTarget | null>(null)
  const [isRejecting, setIsRejecting] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)

  // Apps with the most pending submissions first; optionally only those with submissions.
  const sortedApps = useMemo(() => {
    const visible = onlyWithSubmissions
      ? queue.apps.filter((a) => (queue.submissionCount[a.appId] ?? 0) > 0)
      : queue.apps
    return [...visible].sort(
      (a, b) => (queue.pendingCount[b.appId] ?? 0) - (queue.pendingCount[a.appId] ?? 0),
    )
  }, [queue.apps, queue.submissionCount, queue.pendingCount, onlyWithSubmissions])

  const toggleApp = (appId: string) => {
    if (expandedAppId === appId) {
      setExpandedAppId(null)
      return
    }
    setExpandedAppId(appId)
    void queue.loadApprovals(appId)
  }

  const approve = async (appId: string, versionTag: string) => {
    const ok = await queue.approve(appId, versionTag)
    if (ok) toast.success(t('AdminAppsView.approveSuccess'))
    else toast.error(t('AdminAppsView.approveError'))
  }

  const submitReason = async (
    target: ModalTarget | null,
    reason: string,
    run: (appId: string, versionTag: string, reason: string) => Promise<boolean>,
    setBusy: (busy: boolean) => void,
    close: () => void,
    keys: { success: string; error: string },
  ) => {
    if (!target || !reason.trim()) return
    setBusy(true)
    const ok = await run(target.appId, target.versionTag, reason)
    setBusy(false)
    if (ok) {
      toast.success(t(keys.success))
      close()
    } else {
      toast.error(t(keys.error))
    }
  }

  return (
    <div className="app-page">
      <PageHeader
        title={t('AdminAppsView.title')}
        subtitle={t('AdminAppsView.subtitle')}
        actions={
          <div className="flex items-center gap-2 text-sm">
            <span id={filterLabelId} className="text-textMuted">
              {t('AdminAppsView.filterLabel')}
            </span>
            <button
              type="button"
              role="switch"
              aria-labelledby={filterLabelId}
              aria-checked={onlyWithSubmissions}
              onClick={() => setOnlyWithSubmissions((v) => !v)}
              className={`relative inline-flex h-5 w-10 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                onlyWithSubmissions ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                  onlyWithSubmissions ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-textMuted font-medium">{t('AdminAppsView.filterOnlySubmissions')}</span>
          </div>
        }
      />

      <EntityListState
        isLoading={queue.isLoading && queue.apps.length === 0}
        isEmpty={!queue.isLoading && queue.apps.length === 0}
        icon={Inbox}
        emptyMessage={t('AdminAppsView.emptyAppsTitle')}
      >
        {sortedApps.length === 0 ? (
          // Filter active but no open submissions → dedicated empty state.
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-surfaceMuted border border-dashed border-borderSubtle rounded-xl">
            <div className="w-14 h-14 rounded-full bg-white border border-borderSubtle flex items-center justify-center mb-4">
              <Inbox size={28} className="text-textFaint" />
            </div>
            <h3 className="text-base font-semibold text-textHeading mb-1">
              {t('AdminAppsView.emptyNoSubmissionsTitle')}
            </h3>
            <p className="text-sm text-textMuted max-w-sm">{t('AdminAppsView.emptyNoSubmissionsDesc')}</p>
            <button
              type="button"
              onClick={() => setOnlyWithSubmissions(false)}
              className="mt-5 text-sm font-medium text-primary hover:text-primaryDark underline-offset-2 hover:underline"
            >
              {t('AdminAppsView.emptyShowAll')}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedApps.map((app) => (
              <AppApprovalRow
                key={app.appId}
                app={app}
                pendingCount={queue.pendingCount[app.appId] ?? 0}
                isExpanded={expandedAppId === app.appId}
                isLoading={queue.loadingApprovals[app.appId] ?? false}
                approvals={queue.approvals[app.appId]}
                actingOn={queue.actingOn}
                onToggle={() => toggleApp(app.appId)}
                onApprove={(versionTag) => void approve(app.appId, versionTag)}
                onReject={(versionTag) => setRejectTarget({ appId: app.appId, versionTag })}
                onRevoke={(versionTag) => setRevokeTarget({ appId: app.appId, versionTag })}
              />
            ))}
          </div>
        )}
      </EntityListState>

      <ReasonModal
        show={rejectTarget !== null}
        title={t('AdminAppsView.rejectModal.title')}
        titleClassName="text-red-700"
        versionTag={rejectTarget?.versionTag ?? null}
        reasonLabel={t('AdminAppsView.rejectModal.reasonLabel')}
        reasonPlaceholder={t('AdminAppsView.rejectModal.reasonPlaceholder')}
        cancelLabel={t('AdminAppsView.rejectModal.cancel')}
        submitLabel={t('AdminAppsView.rejectModal.submit')}
        submitVariant="destructive"
        focusClassName="focus:ring-red-400 focus:border-red-400"
        isSubmitting={isRejecting}
        onClose={() => setRejectTarget(null)}
        onSubmit={(reason) =>
          void submitReason(rejectTarget, reason, queue.reject, setIsRejecting, () => setRejectTarget(null), {
            success: 'AdminAppsView.rejectSuccess',
            error: 'AdminAppsView.rejectError',
          })
        }
      />

      <ReasonModal
        show={revokeTarget !== null}
        title={t('AdminAppsView.revokeModal.title')}
        titleClassName="text-textHeading"
        versionTag={revokeTarget?.versionTag ?? null}
        reasonLabel={t('AdminAppsView.revokeModal.reasonLabel')}
        reasonPlaceholder={t('AdminAppsView.revokeModal.reasonPlaceholder')}
        cancelLabel={t('AdminAppsView.revokeModal.cancel')}
        submitLabel={t('AdminAppsView.revokeModal.submit')}
        submitVariant="primary"
        focusClassName="focus:ring-gray-400 focus:border-gray-400"
        isSubmitting={isRevoking}
        onClose={() => setRevokeTarget(null)}
        onSubmit={(reason) =>
          void submitReason(revokeTarget, reason, queue.revoke, setIsRevoking, () => setRevokeTarget(null), {
            success: 'AdminAppsView.revokeSuccess',
            error: 'AdminAppsView.revokeError',
          })
        }
      />
    </div>
  )
}
