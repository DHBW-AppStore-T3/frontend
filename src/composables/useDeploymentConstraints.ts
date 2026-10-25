import { useMemo } from 'react'
import type { DeploymentRuntime } from '@/types'

export interface VersionShape {
  runtime?: DeploymentRuntime | null
  // From the version's appstore.yaml (`GET /apps/{id}/runtime`).
  scope?: 'team' | 'user' | null
}

export interface GroupConstraints {
  forcedGroupMode: 'eachUser' | null
  groupModeReason: string | null
  /** Heading of the notice. */
  groupModeTitle: string | null
}

const PER_PERSON_REASON = 'deployment.assignment.perPersonConstraintText'
const PER_PERSON_TITLE = 'deployment.assignment.perPersonConstraintTitle'

/**
 * Group-mode constraints of the version being deployed.
 *
 * `scope: user` forces one deployment per person (one team per person).
 * The scope comes from the appstore.yaml via the API.
 */
export function groupConstraints(version?: VersionShape | null): GroupConstraints {
  if (version?.scope !== 'user') return { forcedGroupMode: null, groupModeReason: null, groupModeTitle: null }
  return {
    forcedGroupMode: 'eachUser',
    groupModeReason: PER_PERSON_REASON,
    groupModeTitle: PER_PERSON_TITLE,
  }
}

export function useDeploymentConstraints(_app: unknown, version?: VersionShape | null): GroupConstraints {
  const runtime = version?.runtime
  const scope = version?.scope
  return useMemo(() => groupConstraints({ runtime, scope }), [runtime, scope])
}
