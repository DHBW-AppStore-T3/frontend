import type { AppRuntime } from '@/types'

export interface DeployGate {
  /** The caller is a teacher or admin: students use deployments, they do not start them. */
  isStaff: boolean
  version: string
  /** How the version runs; null while loading or when it could not be read. */
  runtime: AppRuntime | null
}

export function canStartDeployment(gate: DeployGate): boolean {
  return gate.isStaff && !!gate.version && !!gate.runtime
}

/** The API names a missing or unreadable `appstore.yaml`; anything else is a plain load error. */
export function runtimeErrorKey(err: unknown): 'AppsDetailView.runtime.invalidSpec' | 'AppsDetailView.runtime.loadError' {
  const detail = (err as { response?: { data?: { detail?: { reason?: string } } } })?.response?.data?.detail
  return detail?.reason === 'invalid_app_spec' ||
    detail?.reason === 'appstore_yaml_missing' ||
    detail?.reason === 'runtime_not_supported'
    ? 'AppsDetailView.runtime.invalidSpec'
    : 'AppsDetailView.runtime.loadError'
}

export { runtimeLabelKey } from '@/utils/runtime'
