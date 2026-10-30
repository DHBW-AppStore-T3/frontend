import { useDeploymentStore } from '@/stores/deployment.store'
import { visibleNetworkKeys } from '@/utils/network'
import type { DeploymentDraft } from '@/types'

/**
 * Whether the wizard needs its "Variables" step for this draft.
 *
 * The step is necessary when the app declares variables, offers resource
 * choices, shows a network switch or lets people choose the scope. Otherwise it would only say "nothing to
 * set" and is left out.
 *
 * ``null`` means "not known yet": the definitions load in the background and
 * ``draft.variableDefinitions`` stays ``undefined`` until they arrive (``[]`` is
 * a loaded, empty answer). Choices come with the draft, so they settle the
 * question without waiting for the definitions.
 */
export function needsVariablesStep(draft: DeploymentDraft): boolean | null {
  if ((draft.resourceChoices ?? []).length > 0 || visibleNetworkKeys(draft).length > 0 || draft.scopeChoice) return true
  const definitions = draft.variableDefinitions
  if (definitions === undefined) return null
  return definitions.length > 0
}

/** ``needsVariablesStep`` of the current draft, re-evaluated when the draft changes. */
export function useNeedsVariablesStep(): boolean | null {
  return useDeploymentStore((s) => needsVariablesStep(s.draft))
}
