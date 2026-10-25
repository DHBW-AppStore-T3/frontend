import { useMemo } from 'react'
import type { App, DeploymentRuntime } from '@/types'

export interface VersionShape {
  runtime?: DeploymentRuntime | null
  // From the version's appstore.yaml (`GET /apps/{id}/runtime`).
  scope?: 'team' | 'user' | null
}

export interface GroupConstraints {
  forcedGroupMode: 'eachUser' | null
  groupModeReason: string | null
  /** Heading of the notice; names the licence only where the licence is the reason. */
  groupModeTitle: string | null
}

const PER_PERSON_REASON = 'deployment.assignment.perPersonConstraintText'
const PER_PERSON_TITLE = 'deployment.assignment.perPersonConstraintTitle'

function forcesOneTeamPerPerson(version?: VersionShape | null): boolean {
  return version?.scope === 'user'
}

/**
 * Group-mode constraints of the version being deployed.
 *
 * `scope: user` forces one deployment per person (one team per person).
 * The scope comes from the appstore.yaml via the API.
 */
export function groupConstraints(app: App | null, version?: VersionShape | null): GroupConstraints {
  if (!forcesOneTeamPerPerson(version)) return { forcedGroupMode: null, groupModeReason: null, groupModeTitle: null }
  return {
    forcedGroupMode: 'eachUser',
    groupModeReason: PER_PERSON_REASON,
    groupModeTitle: PER_PERSON_TITLE,
  }
}

export function useDeploymentConstraints(app: App | null, version?: VersionShape | null): GroupConstraints {
  const runtime = version?.runtime
  const scope = version?.scope
  return useMemo(() => groupConstraints(app, { runtime, scope }), [app, runtime, scope])
}
