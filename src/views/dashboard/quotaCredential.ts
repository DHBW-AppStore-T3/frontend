import type { OpenStackCredential } from '@/types/openstack-credential'

/**
 * The credential whose project the quota tile shows: the current one while
 * it is still usable, else the first usable one, else none.
 */
export function chooseQuotaCredential(
  currentId: string | null,
  usable: OpenStackCredential[],
): string | null {
  if (currentId && usable.some((c) => c.credentialId === currentId)) return currentId
  return usable[0]?.credentialId ?? null
}

export function projectLabel(credential: OpenStackCredential): string {
  return credential.project_name || credential.project_id || ''
}
