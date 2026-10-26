import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Inbox } from 'lucide-react'
import Card from '@/components/ui/Card'
import AppLogo from '@/components/ui/AppLogo'
import EntityListState from '@/components/ui/EntityListState'
import Toggle from '@/views/add-app/Toggle'
import { appApi } from '@/api/app.api'
import { useToast } from '@/composables/useToast'
import type { App } from '@/types'

/** Admins mark which apps the catalog shows under "Recommended". */
export default function RecommendedAppsCard() {
  const { t } = useTranslation()
  const toast = useToast()
  const [apps, setApps] = useState<App[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [savingIds, setSavingIds] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await appApi.list()
        if (!cancelled) setApps(Array.isArray(res.data) ? res.data : [])
      } catch {
        if (!cancelled) setApps([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setRecommended = async (app: App, next: boolean) => {
    setSavingIds((ids) => [...ids, app.appId])
    try {
      const res = await appApi.admin.setRecommended(app.appId, next)
      const saved = res.data?.recommended ?? next
      setApps((prev) => prev.map((a) => (a.appId === app.appId ? { ...a, recommended: saved } : a)))
    } catch {
      toast.error(t('AdminSettingsView.recommended.error'))
    } finally {
      setSavingIds((ids) => ids.filter((id) => id !== app.appId))
    }
  }

  return (
    <Card>
      <p className="font-medium">{t('AdminSettingsView.recommended.title')}</p>
      <p className="text-sm text-muted mb-4">{t('AdminSettingsView.recommended.description')}</p>
      <EntityListState
        isLoading={isLoading}
        isEmpty={!isLoading && apps.length === 0}
        icon={Inbox}
        emptyMessage={t('AdminSettingsView.recommended.empty')}
      >
        <ul className="divide-y divide-border">
          {apps.map((app) => (
            <li key={app.appId} className="flex items-center justify-between gap-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <AppLogo name={app.name} image={app.image} />
                <span className="truncate">{app.name}</span>
              </div>
              <Toggle
                checked={app.recommended === true}
                disabled={savingIds.includes(app.appId)}
                label={t('AdminSettingsView.recommended.toggleLabel', { name: app.name })}
                onChange={(next) => void setRecommended(app, next)}
              />
            </li>
          ))}
        </ul>
      </EntityListState>
    </Card>
  )
}
