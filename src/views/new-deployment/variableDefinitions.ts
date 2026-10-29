import { useAppStore } from '@/stores/app.store'
import { useDeploymentStore } from '@/stores/deployment.store'
import type { AppVariable } from '@/types'
import { dedupeVariables } from './variableForm'
import { versionLabelOf } from './summary'
import { needsVariablesStep } from './variablesStep'

/** The request in flight, so that every caller asking for the same app and version shares it. */
let inflight: { key: string; promise: Promise<AppVariable[]> } | null = null

/**
 * The variable definitions of the draft's app and version.
 *
 * Returns them from ``draft.variableDefinitions`` when they are there (``[]``
 * counts: loaded, and empty). Otherwise the backend is asked once (it sparse-clones
 * the app repo, which takes seconds), the cleaned list is written into the draft
 * and returned. Parallel calls share one request. A failure rejects and leaves the
 * draft "not loaded", so the next call tries again.
 */
export function ensureVariableDefinitions(): Promise<AppVariable[]> {
  const { appId, releaseTag, variableDefinitions } = useDeploymentStore.getState().draft
  if (variableDefinitions !== undefined) return Promise.resolve(variableDefinitions)
  if (!appId) return Promise.reject(new Error('No app selected'))

  const version = versionLabelOf(releaseTag)
  const key = `${appId}@${version}`
  if (inflight?.key === key) return inflight.promise

  const promise: Promise<AppVariable[]> = (async () => {
    const definitions = dedupeVariables((await useAppStore.getState().fetchAppVariables(appId, version)) ?? [])

    // The backend takes seconds: the draft may belong to another app or be reset by now.
    const draft = useDeploymentStore.getState().draft
    if (draft.appId === appId && versionLabelOf(draft.releaseTag) === version && draft.variableDefinitions === undefined) {
      useDeploymentStore.getState().updateDraft({ variableDefinitions: definitions })
    }
    return definitions
  })().finally(() => {
    if (inflight?.promise === promise) inflight = null
  })
  inflight = { key, promise }
  return promise
}

/**
 * ``needsVariablesStep`` of the current draft; waits for the definitions when the answer is
 * still open. Resolves to ``null`` if they cannot be loaded: the step is then not skipped.
 */
export async function resolveNeedsVariablesStep(): Promise<boolean | null> {
  if (needsVariablesStep(useDeploymentStore.getState().draft) === null) {
    try {
      await ensureVariableDefinitions()
    } catch {
      // The variables step shows the known error and offers the settings.
    }
  }
  return needsVariablesStep(useDeploymentStore.getState().draft)
}
