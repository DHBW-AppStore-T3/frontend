import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { paths } from '@/router/paths'
import type { App, AppVersionApproval } from '@/types'
import VersionTable from './VersionTable'

export interface AppApprovalRowProps {
  app: App
  pendingCount: number
  isExpanded: boolean
  isLoading: boolean
  approvals: AppVersionApproval[] | undefined
  actingOn: string | null
  onToggle: () => void
  onApprove: (versionTag: string) => void
  onReject: (versionTag: string) => void
  onRevoke: (versionTag: string) => void
}

const NOTE = 'px-6 py-4 text-sm text-textFaint italic'

export default function AppApprovalRow(props: AppApprovalRowProps) {
  const { app, pendingCount, isExpanded, isLoading, approvals, actingOn } = props
  const { t } = useTranslation()
  const Chevron = isExpanded ? ChevronDown : ChevronRight

  let badge
  if (pendingCount && !app.is_private) {
    badge = (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
        {pendingCount} {t('AdminAppsView.pendingLabel')}
      </span>
    )
  } else if (app.is_private) {
    badge = <span className="text-xs text-purple-400">{t('AdminAppsView.privateLabel')}</span>
  } else {
    badge = <span className="text-xs text-textFaint">{t('AdminAppsView.noPendingLabel')}</span>
  }

  let details
  if (app.is_private) {
    // Private app: no pending submissions shown.
    details = <div className={NOTE}>{t('AdminAppsView.privateAppNote')}</div>
  } else if (isLoading) {
    details = (
      <div className="flex justify-center py-6">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
      </div>
    )
  } else if (!approvals?.length) {
    details = <div className={NOTE}>{t('AdminAppsView.noVersionsSubmitted')}</div>
  } else {
    details = (
      <VersionTable
        approvals={approvals}
        isBusy={(versionTag) => actingOn === `${app.appId}:${versionTag}`}
        onApprove={props.onApprove}
        onReject={props.onReject}
        onRevoke={props.onRevoke}
      />
    )
  }

  return (
    <div className="border border-borderSubtle rounded-xl overflow-hidden">
      {/* App row (header) */}
      <div className="w-full flex items-center gap-4 px-5 py-4 bg-white hover:bg-surfaceMuted transition-colors text-left">
        <button
          type="button"
          className="flex flex-grow items-center gap-4 text-left"
          aria-expanded={isExpanded}
          onClick={props.onToggle}
        >
          <Chevron size={18} className="text-textFaint flex-shrink-0" />
          <span className="font-semibold text-textHeading flex-grow">{app.name}</span>
        </button>
        <Link
          to={paths.app(app.appId)}
          className="text-textFaint hover:text-primary transition-colors p-1 rounded"
          title={t('AdminAppsView.goToApp')}
        >
          <ExternalLink size={15} />
        </Link>
        {badge}
      </div>

      {isExpanded ? <div className="border-t border-borderSubtle bg-surfaceMuted">{details}</div> : null}
    </div>
  )
}
