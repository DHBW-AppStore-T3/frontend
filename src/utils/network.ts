import type { DeploymentDraft, NetworkChoices, NetworkSelection } from '@/types'

type NetworkKey = keyof NetworkChoices
const KEYS: NetworkKey[] = ['internet', 'podNetwork']

/** Pod networking needs somebody to talk to: at least two workloads. */
export const MIN_WORKLOADS_FOR_POD_NETWORK = 2

type DraftShape = Pick<DeploymentDraft, 'scope' | 'studentIds' | 'assignments' | 'groupCount' | 'networkChoices' | 'network'>

/** The author's defaults: the start position of every switch the app offers. */
export function defaultNetwork(choices: NetworkChoices | undefined | null): NetworkSelection {
  const out: NetworkSelection = {}
  for (const key of KEYS) {
    const setting = choices?.[key]
    if (setting) out[key] = !!setting.default
  }
  return out
}

/** One workload per person (``scope: user``) or per team. */
export function workloadCount(draft: Pick<DraftShape, 'scope' | 'studentIds' | 'assignments' | 'groupCount'>): number {
  if (draft.scope === 'user') return draft.studentIds?.length ?? 0
  const teams = Object.keys(draft.assignments ?? {}).length
  return teams || draft.groupCount || 0
}

/** The settings the wizard shows: allowed by the app, pod networking only with two workloads. */
export function visibleNetworkKeys(draft: DraftShape): NetworkKey[] {
  const choices = draft.networkChoices ?? {}
  return KEYS.filter(
    (key) => !!choices[key] && (key !== 'podNetwork' || workloadCount(draft) >= MIN_WORKLOADS_FOR_POD_NETWORK),
  )
}

/** The current value of a setting: the choice made, else the author's default. */
export function networkValue(draft: DraftShape, key: NetworkKey): boolean {
  return draft.network?.[key] ?? !!draft.networkChoices?.[key]?.default
}

/** ``userInputVar.network``: only the keys the app allows; ``undefined`` when there are none. */
export function networkPayload(draft: DraftShape): NetworkSelection | undefined {
  const keys = visibleNetworkKeys(draft)
  if (keys.length === 0) return undefined
  return Object.fromEntries(keys.map((key) => [key, networkValue(draft, key)])) as NetworkSelection
}

/** Settings whose value differs from the author's default (for the summary). */
export function networkDeviations(draft: DraftShape): Array<{ key: NetworkKey; value: boolean }> {
  return visibleNetworkKeys(draft)
    .map((key) => ({ key, value: networkValue(draft, key) }))
    .filter(({ key, value }) => value !== !!draft.networkChoices?.[key]?.default)
}
