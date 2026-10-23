import type { AppRuntime } from '@/types'

export interface DeployGate {
  /** The caller is a teacher or admin: students use deployments, they do not start them. */
  isStaff: boolean
  version: string
  /** How the version runs; null while loading or when it could not be read. */
  runtime: AppRuntime | null
  credentialsResolved: boolean
  hasUsableCredential: boolean
}

/**
 * Pods (`kubernetes`) need no OpenStack credential; VM apps (the Windows
 * desktop) need one whose project Keystone confirmed.
 */
export function needsCredential({ runtime, credentialsResolved, hasUsableCredential }: DeployGate): boolean {
  return runtime?.runtime === 'openstack-vm' && credentialsResolved && !hasUsableCredential
}

export function canStartDeployment(gate: DeployGate): boolean {
  return gate.isStaff && !!gate.version && !!gate.runtime && !needsCredential(gate)
}

/** The API names an unreadable `appstore.yaml`; anything else is a plain load error. */
export function runtimeErrorKey(err: unknown): 'AppsDetailView.runtime.invalidSpec' | 'AppsDetailView.runtime.loadError' {
  const detail = (err as { response?: { data?: { detail?: { reason?: string } } } })?.response?.data?.detail
  return detail?.reason === 'invalid_app_spec'
    ? 'AppsDetailView.runtime.invalidSpec'
    : 'AppsDetailView.runtime.loadError'
}

export const runtimeLabelKey = (runtime: AppRuntime['runtime']) =>
  runtime === 'kubernetes' ? 'runtime.kubernetes' : 'runtime.openstackVm'
