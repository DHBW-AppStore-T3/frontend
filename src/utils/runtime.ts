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

/** Suffix of the deployment-detail confirm texts: `Pods` for pods, `Vm` for a KubeVirt VM. */
export function confirmMessageSuffix(runtime: DeploymentRuntime | null | undefined): 'Pods' | 'Vm' {
  return runtime === 'kubevirt-vm' ? 'Vm' : 'Pods'
}

/** Restart of a workload works for pods and for a KubeVirt VM (the worker restarts the VM). */
export function canRestartWorkloads(runtime: DeploymentRuntime | null | undefined): boolean {
  return runtime === 'kubernetes' || runtime === 'kubevirt-vm'
}

/** Reset (wipe the data) is a pod operation: the backend answers 422 `reset_not_supported` for a VM. */
export function canResetWorkloads(runtime: DeploymentRuntime | null | undefined): boolean {
  return runtime === 'kubernetes'
}
