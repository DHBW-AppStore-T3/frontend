import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BarChart3, Plus, GitBranch, Box, Clock } from 'lucide-react'
import BaseButton from '@/components/ui/BaseButton'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'
import EntityListState from '@/components/ui/EntityListState'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useAppStore } from '@/stores/app.store'
import { formatDateTime } from '@/utils/format'
import { paths } from '@/router/paths'
import { countByGroup, filterByGroup, sortNewestFirst, statusPillClass } from './deployments-list/helpers'

const UNKNOWN_APP_NAME = '-'
const DATE_NO_SECONDS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}

export default function DeploymentsListView() {
  const { t } = useTranslation()
  const deployments = useDeploymentStore((s) => s.deployments)
  const isLoading = useDeploymentStore((s) => s.isLoading)
  const apps = useAppStore((s) => s.apps)
  const [statusFilter, setStatusFilter] = useState('active')

  useEffect(() => {
    void useDeploymentStore.getState().fetchDeployments()
    void useAppStore.getState().fetchApps()
  }, [])

  const sorted = useMemo(() => sortNewestFirst(deployments), [deployments])
  const tabs = useMemo(() => countByGroup(sorted), [sorted])
  const visible = useMemo(() => filterByGroup(sorted, statusFilter), [sorted, statusFilter])

  const appNameOf = (appId: string) => apps.find((a) => a.appId === appId)?.name ?? UNKNOWN_APP_NAME

  const newDeploymentButton = (
    <Link to={paths.apps}>
      <BaseButton className="flex items-center gap-2">
        <Plus size={16} />
        {t('DeploymentsView.newDeployment')}
      </BaseButton>
    </Link>
  )

  return (
    <div className="app-page">
      <PageHeader
        title={t('DeploymentsView.title')}
        subtitle={t('DeploymentsView.subtitle')}
        actions={newDeploymentButton}
      />

      <div className="catalog-tabs" aria-label={t('workspace.deploymentStatus')}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className="catalog-tab"
            aria-pressed={statusFilter === tab.key}
            onClick={() => setStatusFilter(tab.key)}
          >
            {t(`workspace.statusTabs.${tab.key}`)} <span className="catalog-count">{tab.count}</span>
          </button>
        ))}
      </div>

      <EntityListState
        isLoading={isLoading && deployments.length === 0}
        isEmpty={!isLoading && visible.length === 0}
        icon={Box}
        emptyMessage={t('DeploymentsView.deploymentsMissingMessage')}
        emptyAction={newDeploymentButton}
      >
        {/* One card per deployment (name, app, status pill, release tag, date). */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visible.map((deployment) => (
            <Link key={deployment.deploymentId} to={paths.deployment(deployment.deploymentId)} className="block">
              <Card className="flex flex-col h-full cursor-pointer hover:border-primary/30 transition">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <BarChart3 size={20} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-textHeading truncate" title={deployment.name}>
                        {deployment.name}
                      </h3>
                      <p className="text-xs text-textMuted truncate mt-0.5">
                        <Box size={11} className="inline-block mr-1 align-text-bottom" />
                        {appNameOf(deployment.appId)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border capitalize whitespace-nowrap ${statusPillClass(deployment.status)}`}
                  >
                    {deployment.status}
                  </span>
                </div>

                <div className="mt-auto pt-3 border-t border-borderSubtle flex items-center justify-between text-xs text-textMuted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono">
                      <GitBranch size={11} />
                      {deployment.releaseTag}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded border border-borderSubtle text-[10px] uppercase tracking-wide"
                      data-testid="runtime-badge"
                    >
                      {deployment.runtime === 'kubernetes' ? t('runtime.kubernetesShort') : t('runtime.openstackVmShort')}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock size={11} />
                    {formatDateTime(deployment.created_at, DATE_NO_SECONDS)}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </EntityListState>
    </div>
  )
}
