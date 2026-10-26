import { useEffect } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BarChart3, Layers, GraduationCap, ArrowRight } from 'lucide-react'
import { useDashboard } from '@/composables/useDashboard'
import { useAuthStore } from '@/stores/auth.store'
import { useRole } from '@/composables/useRole'
import { paths } from '@/router/paths'
import { greetingNameOf } from '@/utils/user-display'
import './DashboardView.css'

export default function DashboardView() {
  const { t } = useTranslation()
  const { stats, fetchStats } = useDashboard()
  const { isStaff } = useRole()
  const name = greetingNameOf(useAuthStore((s) => s.user))

  useEffect(() => {
    void fetchStats().catch(() => {})
    // Mount-only: a stable module-level action.
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
      {/* Hero banner */}
      <div className="hero-banner">
        <div className="hero-content">
          <h1 className="dashboard-name">
            {name ? t('DashboardView.greeting', { name }) : t('DashboardView.greetingAnonymous')}
          </h1>
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
    </div>
  )
}
