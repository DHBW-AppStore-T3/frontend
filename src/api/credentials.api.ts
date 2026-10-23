import api from './axios'
import type {
  OpenStackCredential,
  OpenStackCredentialFromYaml,
  OpenStackCredentialUpsert,
} from '@/types/openstack-credential'

// ----------------------------------------------------------------
// OPENSTACK CREDENTIALS API — one credential per OpenStack project
// ----------------------------------------------------------------
// Only VM apps (the Windows desktop) need a credential; pod apps run in
// the cluster without one. Every route is scoped to the caller: another
// person's credential id answers 404.
export const credentialsApi = {
  /** The caller's credentials, without secrets. */
  list: () => api.get<OpenStackCredential[]>('/me/openstack-credentials'),

  /**
   * Check against Keystone, then store: 201 for a new project, 200 when the
   * credential for the same project was replaced (how a secret is rotated).
   * 422 ``openstack_credentials_invalid`` (with ``cause``) when Keystone
   * refuses it; nothing is stored then.
   */
  save: (payload: OpenStackCredentialUpsert) =>
    api.post<OpenStackCredential>('/me/openstack-credentials', payload),

  /** Same as ``save``, from a pasted ``clouds.yaml``. */
  saveFromYaml: (body: OpenStackCredentialFromYaml) =>
    api.post<OpenStackCredential>('/me/openstack-credentials/from-yaml', body),

  /**
   * Ask Keystone again. Always 200; a failure shows in the returned
   * credential's ``last_validation_error``. An unverified credential becomes
   * verified with the project Keystone names.
   */
  test: (credentialId: string) =>
    api.post<OpenStackCredential>(`/me/openstack-credentials/${encodeURIComponent(credentialId)}/test`),

  /** 409 ``openstack_credentials_locked`` while live deployments need it. */
  remove: (credentialId: string) =>
    api.delete<void>(`/me/openstack-credentials/${encodeURIComponent(credentialId)}`),
}
