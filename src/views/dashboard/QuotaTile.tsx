import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowRight, XCircle, Loader2, AlertCircle } from 'lucide-react'
import type { OpenStackCredential } from '@/types/openstack-credential'
import type { QuotaRow } from '@/composables/useQuotas'
import { paths } from '@/router/paths'
import { projectLabel } from './quotaCredential'

const SKELETON_ROWS = 6
const WARNING_PERCENTAGE = 60
const DANGER_PERCENTAGE = 80

export interface QuotaTileProps {
  rows: QuotaRow[]
  loading: boolean
  hasCachedQuotas: boolean
  /** Credentials whose project can be shown. */
  usable: OpenStackCredential[]
  selectedCredentialId: string | null
  /** True once the credential list has been read. */
  credentialsResolved: boolean
  getColorClass: (percentage: number) => string
  onSelectCredential: (credentialId: string | null) => void
}

const percentageTone = (percentage: number) =>
  percentage >= DANGER_PERCENTAGE ? 'text-danger' : percentage >= WARNING_PERCENTAGE ? 'text-warning' : 'text-textMuted'

function ProjectPicker({
  usable,
  selectedCredentialId,
  onSelectCredential,
}: Pick<QuotaTileProps, 'usable' | 'selectedCredentialId' | 'onSelectCredential'>) {
  const { t } = useTranslation()

  if (usable.length > 1) {
    return (
      <select
        value={selectedCredentialId ?? ''}
        data-testid="quota-credential"
        className="rounded-lg border border-borderSubtle bg-white py-1 px-2 text-xs text-textHeading"
        aria-label={t('DashboardView.quotaProject')}
        onChange={(e) => onSelectCredential(e.target.value || null)}
      >
        {usable.map((c) => (
          <option key={c.credentialId} value={c.credentialId}>
            {projectLabel(c)}
          </option>
        ))}
      </select>
    )
  }
  if (usable.length === 1) return <span className="text-xs text-textMuted">{projectLabel(usable[0]!)}</span>
  return null
}

function QuotaSkeleton() {
  return (
    <div className="quota-grid">
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <div key={i} className="animate-pulse space-y-2">
          <div className="flex justify-between">
            <div className="h-3 bg-surfaceMuted rounded w-20" />
            <div className="h-3 bg-surfaceMuted rounded w-10" />
          </div>
          <div className="h-1.5 bg-surfaceMuted rounded-full" />
        </div>
      ))}
    </div>
  )
}

function QuotaRowItem({ quota, getColorClass }: { quota: QuotaRow; getColorClass: (p: number) => string }) {
  const { t } = useTranslation()
  const Icon = quota.icon
  return (
    <div className="quota-item">
      <Icon size={28} strokeWidth={1.5} className="quota-icon" aria-hidden="true" />
      <div className="quota-content">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-semibold text-textHeading">{quota.label}</span>
          <span className={`text-xs font-semibold tabular-nums ${percentageTone(quota.percentage)}`}>
            {quota.used}/{quota.limit ?? '∞'}
            {quota.unit}
          </span>
        </div>
        <div className="w-full bg-surfaceMuted rounded-full h-1.5 overflow-hidden">
          <div
            className={`${getColorClass(quota.percentage)} h-1.5 rounded-full transition-all duration-700`}
            style={{ width: `${quota.percentage}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-xs text-textFaint">{t('DashboardView.quotaUsed', { percentage: quota.percentage })}</p>
          {quota.percentage >= DANGER_PERCENTAGE ? <AlertCircle size={11} className="text-danger" /> : null}
        </div>
      </div>
    </div>
  )
}

function NoCredentialHint() {
  const { t } = useTranslation()
  return (
    <div className="px-6 py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-surfaceMuted flex items-center justify-center mx-auto mb-3">
        <XCircle size={22} className="text-textFaint" />
      </div>
      <p className="text-sm font-medium text-textMuted">{t('DashboardView.noCredentialsTitle')}</p>
      <p className="text-xs text-textFaint mt-1 mb-4">{t('DashboardView.noCredentialsHint')}</p>
      <Link
        to={paths.userOpenStack}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primaryDark transition-colors"
      >
        {t('DashboardView.setUpNow')} <ArrowRight size={12} />
      </Link>
    </div>
  )
}

/**
 * OpenStack quota of one credential's project. Only staff see it, and it only
 * matters for VM apps (the Windows desktop).
 */
export default function QuotaTile(props: QuotaTileProps) {
  const { t } = useTranslation()
  const { rows, loading, hasCachedQuotas, credentialsResolved, selectedCredentialId } = props

  return (
    <div className="dashboard-resources ui-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-borderSubtle">
        <h2 className="text-sm font-semibold text-textHeading">{t('DashboardView.availableResources')}</h2>
        <div className="flex items-center gap-3">
          {loading && hasCachedQuotas ? (
            <span className="flex items-center gap-1.5 text-xs text-textFaint">
              <Loader2 size={12} className="animate-spin" />
            </span>
          ) : null}
          <ProjectPicker
            usable={props.usable}
            selectedCredentialId={selectedCredentialId}
            onSelectCredential={props.onSelectCredential}
          />
        </div>
      </div>

      {loading && !hasCachedQuotas ? (
        <QuotaSkeleton />
      ) : rows.length > 0 ? (
        <div className="quota-grid">
          {rows.map((quota) => (
            <QuotaRowItem key={quota.label} quota={quota} getColorClass={props.getColorClass} />
          ))}
        </div>
      ) : credentialsResolved && !selectedCredentialId ? (
        <NoCredentialHint />
      ) : (
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-textFaint">{t('DashboardView.quotaLoadError')}</p>
        </div>
      )}
    </div>
  )
}
