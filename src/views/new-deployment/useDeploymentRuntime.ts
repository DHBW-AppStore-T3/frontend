import { useEffect, useEffectEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { appApi } from '@/api/app.api'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToast } from '@/composables/useToast'
import { defaultSelection } from '@/utils/resources'
import { choiceFits, defaultNetwork } from '@/utils/network'
import type { ResourceChoice } from '@/types'

function sameContainers(chosen: Record<string, unknown> | undefined, choices: ResourceChoice[]) {
  const have = Object.keys(chosen ?? {}).sort().join()
  return have === choices.map((c) => c.container).sort().join()
}

/**
 * Runtime of the wizard's draft (first step).
 *
 * The app detail page put the version's runtime into the draft; a reload or
 * deep link lands here without it, so it is asked again.
 */
export function useDeploymentRuntime() {
  const { t } = useTranslation()
  const toast = useToast()
  const { appId, releaseTag, runtime } = useDeploymentStore(
    useShallow((s) => ({
      appId: s.draft.appId,
      releaseTag: s.draft.releaseTag,
      runtime: s.draft.runtime,
    })),
  )
  const loadRuntime = useEffectEvent(() => {
    // Asked once per app/version; the choices come with the runtime.
    if (runtime || !appId || !releaseTag) return
    let cancelled = false
    appApi
      .getRuntime(appId, String(releaseTag))
      .then(({ data }) => {
        if (cancelled) return
        const choices = data.resources ?? []
        const draft = useDeploymentStore.getState().draft
        const network = data.network ?? {}
        const sameNetwork = choiceFits(draft.network, draft.networkChoices, network)
        useDeploymentStore.getState().updateDraft({
          runtime: data.runtime,
          scope: data.scope ?? null,
          resourceChoices: choices,
          // A choice already made (back and forth in the wizard) stays.
          resources: sameContainers(draft.resources, choices) ? draft.resources : defaultSelection(choices),
          networkChoices: network,
          network: sameNetwork ? draft.network : defaultNetwork(network),
        })
      })
      .catch(() => !cancelled && toast.error(t('AppsDetailView.runtime.loadError')))
    return () => {
      cancelled = true
    }
  })

  // Asked again only for another app/version; `toast` and `t` are read when the answer fails.
  useEffect(() => loadRuntime(), [appId, releaseTag, runtime])
}
