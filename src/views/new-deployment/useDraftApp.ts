import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/app.store'
import { useDeploymentStore } from '@/stores/deployment.store'

/**
 * The app of the wizard's draft (its name and image for the summary).
 *
 * ``useAppStore.apps`` is filled only by ``fetchApps`` and the catalogue keeps its own list, so on
 * the way "catalogue, details, deploy, wizard" the list is empty. The app is then asked for by its
 * id, once. ``isLoading`` is true until that answer is in; when the backend does not know the app,
 * ``app`` stays ``null``.
 */
export function useDraftApp() {
  const appId = useDeploymentStore((s) => s.draft.appId)
  const app = useAppStore(
    (s) => s.apps.find((a) => a.appId === appId) ?? (s.currentApp?.appId === appId ? s.currentApp : null),
  )
  const [asked, setAsked] = useState(false)

  useEffect(() => {
    if (!appId || app) return
    let cancelled = false
    void useAppStore
      .getState()
      .fetchAppById(appId)
      .finally(() => {
        if (!cancelled) setAsked(true)
      })
    return () => {
      cancelled = true
    }
  }, [appId, app])

  return { app, isLoading: !!appId && !app && !asked }
}
