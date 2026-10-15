import { computed } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import type { App, DeploymentRuntime } from '@/types'

export interface VersionShape {
  runtime?: DeploymentRuntime | null
  // From the version's appstore.yaml (``GET /apps/{id}/runtime``).
  scope?: 'team' | 'user' | null
}

/**
 * Group-mode constraints of the version being deployed.
 *
 * ``scope: user`` (one workload or VM per person, e.g. the Windows desktop)
 * forces one team per person. The scope comes from the API. Only a VM app
 * that declares none (no appstore.yaml yet) falls back to the old rule "the
 * name contains 'windows'".
 */
export function useDeploymentConstraints(
  app: MaybeRefOrGetter<App | null>,
  version?: MaybeRefOrGetter<VersionShape | null | undefined>,
): {
  forcedGroupMode: ComputedRef<'eachUser' | null>
  groupModeReason: ComputedRef<string | null>
} {
  const byName = computed(() => toValue(app)?.name.toLowerCase().includes('windows') ?? false)

  const forcedGroupMode = computed<'eachUser' | null>(() => {
    const v = toValue(version)
    if (v?.scope === 'user') return 'eachUser'
    if (v?.scope === 'team') return null
    if (v?.runtime === 'kubernetes') return null
    return byName.value ? 'eachUser' : null
  })

  const groupModeReason = computed<string | null>(() => {
    if (forcedGroupMode.value === null) return null
    return toValue(version)?.scope === 'user'
      ? 'deployment.assignment.perPersonConstraintText'
      : 'deployment.assignment.windowsConstraintText'
  })

  return { forcedGroupMode, groupModeReason }
}
