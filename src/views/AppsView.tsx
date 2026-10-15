import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Inbox, Plus, Globe, Lock, Search, SlidersHorizontal, Star } from 'lucide-react'
import BaseButton from '@/components/ui/BaseButton'
import AppLogo from '@/components/ui/AppLogo'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'
import EntityListState from '@/components/ui/EntityListState'
import AppVersionStatusBadge from '@/components/ui/AppVersionStatusBadge'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import { appApi } from '@/api/app.api'
import { APP_CATEGORIES, appPresentation, type AppCategory } from '@/config/app-catalog'
import { useFavorites } from '@/composables/useFavorites'
import { useToast } from '@/composables/useToast'
import { useAuthStore, selectIsAdmin, selectUserId } from '@/stores/auth.store'
import { paths } from '@/router/paths'
import type { App, AppVersionApproval, AppVersionBadgeStatus } from '@/types'
import './AppsView.css'

type VisibilityFilter = 'all' | 'public' | 'private'

export default function AppsView() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const isAdmin = useAuthStore(selectIsAdmin)
  const userId = useAuthStore(selectUserId)

  const [isLoading, setIsLoading] = useState(false)
  const [apps, setApps] = useState<App[]>([])
  const [approvalsMap, setApprovalsMap] = useState<Record<string, AppVersionApproval[]>>({})

  // Admin-only filter
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<AppCategory | 'all' | 'favorites'>('all')
  const [showFilters, setShowFilters] = useState(false)
  const { favorites, toggleFavorite } = useFavorites(userId)

  const isOwnApp = (app: App) => String(app.userId) === String(userId)

  const visibleApps = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase()
    return apps.filter(
      (app) =>
        (!isAdmin ||
          visibilityFilter === 'all' ||
          (visibilityFilter === 'private' ? app.is_private : !app.is_private)) &&
        `${app.name} ${app.description ?? ''}`.toLocaleLowerCase().includes(q),
    )
  }, [apps, isAdmin, visibilityFilter, searchQuery])

  const categories = [
    { key: 'all' as const, count: visibleApps.length },
    ...APP_CATEGORIES.map((key) => ({
      key,
      count: visibleApps.filter((app) => appPresentation(app.name).category === key).length,
    })),
    { key: 'favorites' as const, count: visibleApps.filter((app) => favorites.includes(app.appId)).length },
  ]

  const filteredApps = visibleApps.filter(
    (app) =>
      selectedCategory === 'all' ||
      (selectedCategory === 'favorites'
        ? favorites.includes(app.appId)
        : appPresentation(app.name).category === selectedCategory),
  )

  const badgeStatusForApp = (app: App): AppVersionBadgeStatus | null => {
    if (!isOwnApp(app)) return null
    if (app.is_private) return 'private'
    const approvals = approvalsMap[app.appId] ?? []
    if (approvals.some((a) => a.status === 'approved')) return 'published'
    if (approvals.some((a) => a.status === 'pending')) return 'pending'
    return 'new'
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      try {
        const response = await appApi.list()
        const list: App[] = response.data && Array.isArray(response.data) ? response.data : []
        if (cancelled) return
        setApps(list)

        const own = list.filter((a) => String(a.userId) === String(useAuthStore.getState().user?.userId))
        const entries = await Promise.all(
          own.map(async (app) => {
            try {
              const res = await appApi.listVersionApprovals(app.appId)
              return [app.appId, res.data] as const
            } catch {
              return [app.appId, [] as AppVersionApproval[]] as const
            }
          }),
        )
        if (!cancelled) setApprovalsMap(Object.fromEntries(entries))
      } catch (error) {
        console.error('Fehler beim Laden der Apps:', error)
        if (!cancelled) {
          toast.error(t('AppsView.loadError'))
          setApps([])
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // Mount-only load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDeploy = (app: App, configure = false) => {
    navigate({ pathname: paths.app(app.appId), hash: configure ? '#deployment-options' : '' })
  }

  const filterButton = (value: VisibilityFilter, label: string, icon?: React.ReactNode) => (
    <button
      key={value}
      type="button"
      onClick={() => setVisibilityFilter(value)}
      className={`${icon ? 'flex items-center gap-1.5 ' : ''}px-3 py-1.5 rounded-md font-medium transition-colors ${
        visibilityFilter === value ? 'bg-white text-textHeading shadow-sm' : 'text-textMuted hover:text-textMuted'
      }`}
    >
      {icon}
      {label}
    </button>
  )

  const addAppButton = (
    <Link to={paths.appCreate}>
      <BaseButton className="flex items-center gap-2">
        <Plus size={16} />
        {t('AppsView.addApp')}
      </BaseButton>
    </Link>
  )

  const emptyMessage =
    visibilityFilter === 'private'
      ? t('AppsView.noPrivateApps')
      : visibilityFilter === 'public'
        ? t('AppsView.noPublicApps')
        : t('AppsView.noAppsDesc')

  return (
    <div className="app-page">
      <PageHeader
        eyebrow={t('nav.apps')}
        title={t('AppsView.title')}
        subtitle={t('AppsView.subtitle')}
        actions={
          <>
            <label className="search-field">
              <Search size={16} aria-hidden="true" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('workspace.searchApps')}
                aria-label={t('workspace.searchApps')}
                type="search"
              />
            </label>
            {isAdmin ? (
              <button
                type="button"
                className="icon-button"
                aria-label={t('workspace.filters')}
                aria-expanded={showFilters}
                onClick={() => setShowFilters((v) => !v)}
              >
                <SlidersHorizontal size={16} />
              </button>
            ) : null}
            {/* Admin-only visibility filter */}
            {isAdmin && showFilters ? (
              <div className="flex items-center bg-surfaceMuted rounded-lg p-1 gap-1 text-sm">
                {filterButton('all', t('AppsView.filterAll'))}
                {filterButton('public', t('AppsView.filterPublic'), <Globe size={13} />)}
                {filterButton('private', t('AppsView.filterPrivate'), <Lock size={13} />)}
              </div>
            ) : null}
            {addAppButton}
          </>
        }
      />

      <div className="catalog-tabs" aria-label={t('workspace.categories.label')}>
        {categories.map((category) => (
          <button
            key={category.key}
            type="button"
            className="catalog-tab"
            aria-pressed={selectedCategory === category.key}
            onClick={() => setSelectedCategory(category.key)}
          >
            {t(`workspace.categories.${category.key}`)} <span className="catalog-count">{category.count}</span>
          </button>
        ))}
      </div>

      <EntityListState
        isLoading={isLoading && apps.length === 0}
        isEmpty={!isLoading && filteredApps.length === 0}
        icon={Inbox}
        emptyMessage={emptyMessage}
        loadingMessage={t('AppsView.loading')}
        emptyAction={visibilityFilter === 'all' ? addAppButton : null}
      >
        <div className="app-catalog-grid">
          {filteredApps.map((app) => {
            const badge = badgeStatusForApp(app)
            const isFavorite = favorites.includes(app.appId)
            return (
              <Card key={app.appId} className="catalog-card">
                <div className="catalog-card-top">
                  <AppLogo name={app.name} image={app.image} />
                  <button
                    type="button"
                    className="favorite-button"
                    aria-label={t('workspace.favorite', { name: app.name })}
                    aria-pressed={isFavorite}
                    onClick={() => toggleFavorite(app.appId)}
                  >
                    <Star size={18} fill={isFavorite ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <Link to={paths.app(app.appId)} className="catalog-app-name">
                  {app.name}
                </Link>
                {badge ? (
                  <span className="self-start">
                    <AppVersionStatusBadge status={badge} />
                  </span>
                ) : null}
                <div lang={i18n.language} className="catalog-description">
                  {app.description?.trim() ? (
                    <MarkdownRenderer source={app.description} variant="compact" clamp={3} />
                  ) : (
                    <p>{t('AppsView.noDescription')}</p>
                  )}
                </div>
                <div className="catalog-card-actions">
                  <BaseButton onClick={() => handleDeploy(app)}>{t('workspace.details')}</BaseButton>
                  <BaseButton variant="outline" onClick={() => handleDeploy(app, true)}>
                    {t('workspace.deploy')}
                  </BaseButton>
                </div>
              </Card>
            )
          })}
        </div>
      </EntityListState>
    </div>
  )
}
