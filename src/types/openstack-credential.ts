export type OpenStackAuthType = 'v3applicationcredential' | 'password'

export interface OpenStackCredentialBase {
  auth_type: OpenStackAuthType
  auth_url: string
  region_name?: string | null
  interface?: string | null
  identity_api_version?: string | null
  project_id?: string | null
  project_name?: string | null
  user_domain_name?: string | null
  project_domain_name?: string | null
}

export interface OpenStackCredentialUpsert extends OpenStackCredentialBase {
  identifier: string
  secret: string
}

export interface OpenStackCredentialFromYaml {
  clouds_yaml: string
  cloud_name?: string | null
}

/**
 * One stored credential, one per OpenStack project (``GET
 * /me/openstack-credentials`` returns a list). Never carries the identifier
 * or the secret.
 *
 * ``project_id``/``project_name`` are what Keystone scoped the credential
 * to once ``project_verified``. A credential saved before projects were
 * checked stays unverified until its owner presses "check" once; it cannot
 * be deployed with until then. ``active_deployments`` counts the owner's
 * live deployments in the project; deleting is refused while there are any.
 */
export interface OpenStackCredential extends OpenStackCredentialBase {
  credentialId: string
  project_verified: boolean
  last_validated_at?: string | null
  last_validation_error?: string | null
  created_at?: string | null
  updated_at?: string | null
  active_deployments: number
}

/**
 * @deprecated Shape of the old single-credential endpoint. Only the not yet
 * migrated API client, store and settings form use it; removed with AP2
 * (frontend#36).
 */
export interface OpenStackCredentialResponse extends Partial<OpenStackCredentialBase> {
  has_credential: boolean
  last_validated_at?: string | null
  last_validation_error?: string | null
  created_at?: string | null
  updated_at?: string | null
  is_locked: boolean
  active_deployments: number
}
