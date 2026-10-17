import { useEffect } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BarChart3, Layers, GraduationCap, ArrowRight, XCircle, Loader2, AlertCircle } from 'lucide-react'
import { useDashboard } from '@/composables/useDashboard'
import { useQuotas } from '@/composables/useQuotas'
import {
  useOpenStackCredentialsStore,
  selectIsResolved,
  selectHasCredential,
  selectLastError,
} from '@/stores/openstack-credentials.store'
import { useAuthStore } from '@/stores/auth.store'
import { useRole } from '@/composables/useRole'
import CredentialMissingBanner from '@/components/CredentialMissingBanner'
import { paths } from '@/router/paths'
import './DashboardView.css'

export default function DashboardView() {
  const { t } = useTranslation()
  const { stats, fetchStats } = useDashboard()
  const {
    formattedQuotas,
    loading: quotasLoading,
    needsCredentials,
    hasCachedQuotas,
    fetchQuotas,
    getColorClass,
  } = useQuotas()
  const isResolved = useOpenStackCredentialsStore(selectIsResolved)
  const hasCredential = useOpenStackCredentialsStore(selectHasCredential)
  const lastError = useOpenStackCredentialsStore(selectLastError)
  const username = useAuthStore((s) => s.user?.username) || ''
  const { isStaff } = useRole()

  const firstName = username.charAt(0).toUpperCase() + username.slice(1)

  const hour = new Date().getHours()
  const timeGreeting =
    hour < 12
      ? t('DashboardView.timeGreetings.morning')
      : hour < 18
        ? t('DashboardView.timeGreetings.afternoon')
        : t('DashboardView.timeGreetings.evening')

  useEffect(() => {
    void fetchStats().catch(() => {})
    void fetchQuotas()
    const creds = useOpenStackCredentialsStore.getState()
    if (!creds.status) void creds.fetch()
    // Mount-only: these are stable module-level actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const kpiArrow = (
    <ArrowRight
      size={14}
      className="ml-auto text-textFaint group-hover:text-primary group-hover:translate-x-0.5 transition-all"
    />
  )

  return (
    <div className="dashboard-page">
      {/* Banners */}
      {isResolved && !hasCredential ? (
        <CredentialMissingBanner
          variant="warning"
          title={t('banners.credentialsMissing.title')}
          message={t('banners.credentialsMissing.message')}
          cta={t('banners.credentialsMissing.cta')}
          ctaTo={paths.userOpenStack}
        />
      ) : isResolved && lastError ? (
        <CredentialMissingBanner
          variant="error"
          title={t('banners.credentialsInvalid.title')}
          message={lastError}
          cta={t('banners.credentialsInvalid.cta')}
          ctaTo={paths.userOpenStack}
        />
      ) : null}

      {/* Hero banner */}
      <div className="hero-banner">
        <div className="hero-content">
          <p className="page-eyebrow">{timeGreeting}</p>
          <h1 className="dashboard-name">{firstName}</h1>
          <p className="dashboard-subtitle">{t('DashboardView.subtitle')}</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-row">
        <Link to={paths.deployments} className="kpi-item group">
          <div className="kpi-icon-wrap" style={{ background: 'rgb(var(--color-primary) / 0.10)' }}>
            <BarChart3 size={16} className="text-primary" />
          </div>
          <div>
            <p className="kpi-num">{stats.deployments}</p>
            <p className="kpi-lbl">{t('DashboardView.deployments')}</p>
          </div>
          {kpiArrow}
        </Link>

        <Link to={paths.apps} className="kpi-item group">
          <div className="kpi-icon-wrap" style={{ background: 'rgb(var(--color-brand-accent) / 0.10)' }}>
            <Layers size={16} className="text-brandAccent" />
          </div>
          <div>
            <p className="kpi-num">{stats.apps}</p>
            <p className="kpi-lbl">{t('DashboardView.apps')}</p>
          </div>
          {kpiArrow}
        </Link>

        {/* Courses tile: students have no courses access (staff-only route),
            so hide the tile instead of a 403 on click. */}
        {isStaff ? (
          <Link to={paths.courses} className="kpi-item group">
            <div className="kpi-icon-wrap" style={{ background: 'rgb(var(--color-info) / 0.08)' }}>
              <GraduationCap size={16} className="text-info" />
            </div>
            <div>
              <p className="kpi-num">{stats.courses}</p>
              <p className="kpi-lbl">{t('DashboardView.courses')}</p>
            </div>
            {kpiArrow}
          </Link>
        ) : null}
      </div>

      {/* Available resources — full width, two-column quotas list */}
      <div className="dashboard-resources ui-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-borderSubtle">
          <h2 className="text-sm font-semibold text-textHeading">{t('DashboardView.availableResources')}</h2>
          {quotasLoading && hasCachedQuotas ? (
            <span className="flex items-center gap-1.5 text-xs text-textFaint">
              <Loader2 size={12} className="animate-spin" />
            </span>
          ) : null}
        </div>

        {quotasLoading && !hasCachedQuotas ? (
          // Skeleton (initial load)
          <div className="quota-grid">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="flex justify-between">
                  <div className="h-3 bg-surfaceMuted rounded w-20" />
                  <div className="h-3 bg-surfaceMuted rounded w-10" />
                </div>
                <div className="h-1.5 bg-surfaceMuted rounded-full" />
              </div>
            ))}
          </div>
        ) : formattedQuotas.length > 0 ? (
          // Quotas: two columns on >= md
          <div className="quota-grid">
            {formattedQuotas.map((quota) => {
              const Icon = quota.icon
              return (
                <div key={quota.label} className="quota-item">
                  <Icon size={28} strokeWidth={1.5} className="quota-icon" aria-hidden="true" />
                  <div className="quota-content">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-textHeading">{quota.label}</span>
                      </div>
                      <span
                        className={`text-xs font-semibold tabular-nums ${
                          quota.percentage >= 80
                            ? 'text-danger'
                            : quota.percentage >= 60
                              ? 'text-warning'
                              : 'text-textMuted'
                        }`}
                      >
                        {quota.used}/{quota.limit}
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
                      <p className="text-xs text-textFaint">
                        {t('DashboardView.quotaUsed', { percentage: quota.percentage })}
                      </p>
                      {quota.percentage >= 80 ? <AlertCircle size={11} className="text-danger" /> : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : needsCredentials ? (
          // No credentials
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
        ) : (
          // Error / no data
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-textFaint">{t('DashboardView.quotaLoadError')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
