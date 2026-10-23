import type { OpenStackCredential } from '@/types/openstack-credential'

/**
 * Which credential (OpenStack project) the wizard deploys with.
 *
 * Pods run in the cluster and need none. A VM app keeps the current choice
 * while it is still usable (not deleted, not failing its check), takes the
 * only usable credential by default, and otherwise leaves the choice to the
 * teacher.
 */
export function chooseCredentialId(
  needsCredential: boolean,
  currentId: string | null | undefined,
  usable: OpenStackCredential[],
): string | null {
  if (!needsCredential) return null
  if (currentId && usable.some((c) => c.credentialId === currentId)) return currentId
  return usable.length === 1 ? (usable[0]?.credentialId ?? null) : null
}
