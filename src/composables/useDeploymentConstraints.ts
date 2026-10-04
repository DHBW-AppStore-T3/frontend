import { computed } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import type { App } from '@/types'

export function useDeploymentConstraints(app: MaybeRefOrGetter<App | null>): {
  forcedGroupMode: ComputedRef<'eachUser' | null>
  groupModeReason: ComputedRef<string | null>
} {
  const forcedGroupMode = computed<'eachUser' | null>(() =>
    toValue(app)?.name.toLowerCase().includes('windows') ? 'eachUser' : null
  )

  const groupModeReason = computed<string | null>(() =>
    forcedGroupMode.value !== null ? 'deployment.assignment.windowsConstraintText' : null
  )

  return { forcedGroupMode, groupModeReason }
}
