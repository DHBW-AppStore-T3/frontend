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
const WINDOWS_REASON = 'deployment.assignment.windowsConstraintText'
const PER_PERSON_TITLE = 'deployment.assignment.perPersonConstraintTitle'
const WINDOWS_TITLE = 'deployment.assignment.windowsConstraintTitle'

const isWindowsByName = (app: App | null) => app?.name.toLowerCase().includes('windows') ?? false

function forcesOneTeamPerPerson(app: App | null, version?: VersionShape | null): boolean {
  if (version?.scope === 'user') return true
  if (version?.scope === 'team') return false
  if (version?.runtime === 'kubernetes') return false
  return isWindowsByName(app)
}

/**
 * Group-mode constraints of the version being deployed.
 *
 * `scope: user` (one workload or VM per person, e.g. the Windows desktop)
 * forces one team per person. The scope comes from the API. Only a VM app
 * that declares none (no appstore.yaml yet) falls back to the old rule "the
 * name contains 'windows'".
 */
export function groupConstraints(app: App | null, version?: VersionShape | null): GroupConstraints {
  if (!forcesOneTeamPerPerson(app, version)) return { forcedGroupMode: null, groupModeReason: null, groupModeTitle: null }
  const perPerson = version?.scope === 'user'
  return {
    forcedGroupMode: 'eachUser',
    groupModeReason: perPerson ? PER_PERSON_REASON : WINDOWS_REASON,
    groupModeTitle: perPerson ? PER_PERSON_TITLE : WINDOWS_TITLE,
  }
}

export function useDeploymentConstraints(app: App | null, version?: VersionShape | null): GroupConstraints {
  const runtime = version?.runtime
  const scope = version?.scope
  return useMemo(() => groupConstraints(app, { runtime, scope }), [app, runtime, scope])
}
