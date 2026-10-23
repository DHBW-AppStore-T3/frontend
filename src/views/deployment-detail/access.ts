/**
 * What the caller may see and do on a deployment, as the API decides it
 * (`permissions` and `actions` of the detail response) instead of guessed
 * from the role: another teacher is not the owner of every deployment, and an
 * admin on a VM deployment sees but cannot operate (.github#7 F).
 */
import type { DeploymentAction, DeploymentPermissions, DeploymentWithRelations } from '@/types'

const NO_PERMISSIONS: DeploymentPermissions = { owner_view: false, operate: false, member: false }

type Detail = Pick<DeploymentWithRelations, 'permissions' | 'actions' | 'status'> | null | undefined

export const permissionsOf = (deployment: Detail): DeploymentPermissions =>
  deployment?.permissions ?? NO_PERMISSIONS

/** The right to operate, and the lifecycle allows the action right now. */
export const allows = (deployment: Detail, action: DeploymentAction): boolean =>
  permissionsOf(deployment).operate && (deployment?.actions ?? []).includes(action)

// States from which pause is the retry that matches what just broke.
const PAUSE_STATES = ['success', 'pause_failed', 'redeploy_failed']
const RESUME_STATES = ['paused', 'resume_failed']

export interface LifecycleGates {
  canCancel: boolean
  /** One Delete button: the backend picks destroy (resources may exist) or a straight soft-delete. */
  canDelete: boolean
  /** Per-VM redeploy / per-workload restart and reset. */
  canRedeploy: boolean
  canPause: boolean
  canResume: boolean
  canPauseOrResume: boolean
  /** What the single Pause/Resume button does; from a failure state, the retry that matches. */
  pauseResumeAction: 'pause' | 'resume' | null
}

export function lifecycleGates(deployment: Detail): LifecycleGates {
  const canPause = allows(deployment, 'pause')
  const canResume = allows(deployment, 'resume')
  const status = deployment?.status ?? ''

  let pauseResumeAction: LifecycleGates['pauseResumeAction'] = null
  if (canPause && PAUSE_STATES.includes(status)) pauseResumeAction = 'pause'
  else if (canResume && RESUME_STATES.includes(status)) pauseResumeAction = 'resume'
  else if (canPause) pauseResumeAction = 'pause'
  else if (canResume) pauseResumeAction = 'resume'

  return {
    canCancel: allows(deployment, 'cancel'),
    canDelete: allows(deployment, 'destroy') || allows(deployment, 'delete'),
    canRedeploy: allows(deployment, 'redeploy'),
    canPause,
    canResume,
    canPauseOrResume: canPause || canResume,
    pauseResumeAction,
  }
}
