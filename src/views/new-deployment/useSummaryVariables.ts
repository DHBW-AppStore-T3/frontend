import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app.store'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToast } from '@/composables/useToast'
import type { AppVariable, StoredValues } from '@/types'
import { parseStoredInput } from './variableForm'
import { ensureVariableDefinitions } from './variableDefinitions'

/**
 * The variable definitions shown by the summary.
 *
 * A cache hit (``draft.variableDefinitions``, also an empty one: the app has no
 * variables) always wins, so the page renders immediately and does not depend on
 * the apps list. Only for deep links / reloads are the definitions fetched from
 * the backend (it sparse-clones the app repo, which can take seconds) and their
 * defaults merged into the draft (defaults first, then user overrides).
 */
export function useSummaryVariables() {
  const { t } = useTranslation()
  const toast = useToast()

  const [defs, setDefs] = useState<AppVariable[]>(
    () => useDeploymentStore.getState().draft.variableDefinitions ?? [],
  )
  const [isLoading, setIsLoading] = useState(
    () => useDeploymentStore.getState().draft.variableDefinitions === undefined,
  )

  useEffect(() => {
    let cancelled = false
    const drafts = useDeploymentStore.getState()

    void (async () => {
      if (drafts.draft.variableDefinitions !== undefined) return

      try {
        const apps = useAppStore.getState()
        if (apps.apps.length === 0) await apps.fetchApps()
        const app = useAppStore.getState().apps.find((a) => a.appId === drafts.draft.appId)
        if (!app?.appId) {
          console.warn('No app selected or app not found')
          return
        }

        const variables = await ensureVariableDefinitions()
        if (cancelled) return

        const overrides = parseStoredInput(drafts.draft.userInputVar, () =>
          toast.error(t('deployment.summary.invalidJson')),
        )
        const merged: StoredValues = { ...(drafts.draft.variables ?? {}) }
        for (const v of variables) {
          if (merged[v.name] === undefined && v.default !== undefined) merged[v.name] = v.default
        }
        Object.assign(merged, overrides)

        useDeploymentStore.getState().updateDraft({ variables: merged })
        setDefs(variables)
      } catch (error) {
        console.error(error)
        if (cancelled) return
        toast.error(
          (error as { response?: { status?: number } } | null | undefined)?.response?.status === 500
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
