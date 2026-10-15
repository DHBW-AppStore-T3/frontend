import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app.store'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToast } from '@/composables/useToast'
import { ensureLoaded } from '@/composables/useOpenStackResourceCache'
import type { OsResourceType } from '@/api/openstack-resources.api'
import type { AppVariable } from '@/types'
import { versionLabelOf } from './summary'

/** Fills the display cache so summary rows show resource names instead of UUIDs. */
async function primeOsDisplayCache(defs: AppVariable[]): Promise<void> {
  const types = new Set<OsResourceType>()
  for (const def of defs) {
    // ``file`` is a frontend-only pseudo-type; the cache only tracks real resources.
    if (def.osType && def.osType !== 'file') types.add(def.osType as OsResourceType)
  }
  await Promise.all([...types].map((type) => ensureLoaded(type)))
}

function parseUserOverrides(raw: unknown, onInvalid: () => void): Record<string, any> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, any>
  if (typeof raw === 'string' && raw.trim() !== '') {
    try {
      return JSON.parse(raw)
    } catch (e) {
      console.warn('Invalid JSON in userInputVar', e)
      onInvalid()
    }
  }
  return {}
}

/**
 * The variable definitions shown by the summary.
 *
 * A cache hit from the variables step (``draft.variableDefinitions``) always
 * wins, so the page renders immediately and does not depend on the apps list.
 * Only for deep links / reloads are the definitions fetched from the backend
 * (it sparse-clones the app repo, which can take seconds) and merged into the
 * draft (defaults first, then user overrides).
 */
export function useSummaryVariables() {
  const { t } = useTranslation()
  const toast = useToast()

  const [defs, setDefs] = useState<AppVariable[]>(
    () => useDeploymentStore.getState().draft.variableDefinitions ?? [],
  )
  const [isLoading, setIsLoading] = useState(
    () => !(useDeploymentStore.getState().draft.variableDefinitions?.length),
  )

  useEffect(() => {
    let cancelled = false
    const drafts = useDeploymentStore.getState()
    const cached = drafts.draft.variableDefinitions

    void (async () => {
      if (cached && cached.length > 0) {
        await primeOsDisplayCache(cached)
        return
      }

      try {
        const apps = useAppStore.getState()
        if (apps.apps.length === 0) await apps.fetchApps()
        const app = useAppStore.getState().apps.find((a) => a.appId === drafts.draft.appId)
        if (!app?.appId) {
          console.warn('No app selected or app not found')
          return
        }

        const variables =
          (await useAppStore.getState().fetchAppVariables(app.appId, versionLabelOf(drafts.draft.releaseTag))) ?? []
        if (cancelled) return

        const overrides = parseUserOverrides(drafts.draft.userInputVar, () =>
          toast.error(t('deployment.summary.invalidJson')),
        )
        const merged: Record<string, any> = { ...(drafts.draft.variables ?? {}) }
        for (const v of variables) {
          if (merged[v.name] === undefined && v.default !== undefined) merged[v.name] = v.default
        }
        Object.assign(merged, overrides)

        useDeploymentStore.getState().updateDraft({ variableDefinitions: variables, variables: merged })
        setDefs(variables)
        void primeOsDisplayCache(variables)
      } catch (error: any) {
        console.error(error)
        if (cancelled) return
        toast.error(
          error?.response?.status === 500
            ? t('deployment.summary.fetchVarsError500')
            : t('deployment.summary.fetchVarsError'),
        )
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // Entry load, once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { defs, isLoading }
}
