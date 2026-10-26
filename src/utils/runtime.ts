import type { DeploymentRuntime } from '@/types'

/**
 * Whether a deployment lives in this cluster (pods or KubeVirt VMs). False while the runtime
 * is not known yet.
 */
export function isClusterRuntime(runtime: DeploymentRuntime | null | undefined): boolean {
  return runtime === 'kubernetes' || runtime === 'kubevirt-vm'
}

/** i18n key of the long name (``long``) or the list badge (``short``) of a runtime. */
export function runtimeLabelKey(runtime: DeploymentRuntime | null | undefined, form: 'long' | 'short' = 'long'): string {
  const base = runtime === 'kubernetes' ? 'kubernetes' : runtime === 'kubevirt-vm' ? 'kubevirtVm' : 'kubernetes'
  return `runtime.${base}${form === 'short' ? 'Short' : ''}`
}
