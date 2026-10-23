import type { OpenStackCredential } from '@/types/openstack-credential'

export type CredentialHealth = 'unverified' | 'failing' | 'ok'

/**
 * `unverified`: saved before projects were checked, its project id was typed
 * in and cannot be deployed with until its owner checks it once.
 * `failing`: Keystone refused it at the last check.
 */
export function credentialHealth(credential: OpenStackCredential): CredentialHealth {
  if (!credential.project_verified) return 'unverified'
  return credential.last_validation_error ? 'failing' : 'ok'
}

/** A credential with active deployments cannot be deleted (the API answers 409). */
export const isDeletable = (credential: OpenStackCredential) => credential.active_deployments === 0

/**
 * The step a user came from (`?next=`). Only a path inside the app is
 * followed (never "//host", "/\host" or "https://..."), so a crafted link
 * cannot use the settings page to send someone elsewhere.
 */
export function safeAppPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : null
}
