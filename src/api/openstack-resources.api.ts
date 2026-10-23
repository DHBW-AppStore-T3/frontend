/**
 * Read API for the OpenStack resources of one of the caller's credentials.
 *
 * Used by the ``OpenStackResourcePicker`` so wizard users don't have to copy
 * UUIDs from Horizon. Every list is read with the credential the deployment
 * will be created with (``/me/openstack-credentials/{id}/resources/…``), so
 * the picker shows exactly that project. The backend caches responses for
 * 60s, so the frontend can call freely without triggering a Keystone token
 * storm.
 *
 * Error strategy: the backend answers 404 (not the caller's credential) /
 * 502 (OpenStack API down) / 200 (with data); the picker reads the status
 * and renders the matching fallback.
 */
import api from './axios'

// ----------------------------------------------------------------
// Resource shapes — kept flat, only what the UI needs.
// ----------------------------------------------------------------
export interface OsResourceBase {
  id: string
  name: string
}

export interface OsNetwork extends OsResourceBase {
  description: string
  shared: boolean
  external: boolean
  status: string
}

export interface OsSubnet extends OsResourceBase {
  cidr: string
  ip_version: number
  network_id: string
  gateway_ip: string
}

export interface OsFlavor extends OsResourceBase {
  vcpus: number
  ram: number   // MB
  disk: number  // GB
  is_public: boolean
}

export interface OsImage extends OsResourceBase {
  status: string
  visibility: string
  size: number
  disk_format: string
}

export interface OsKeypair extends OsResourceBase {
  fingerprint: string
  type: string
}

export interface OsSecurityGroup extends OsResourceBase {
  description: string
}

export interface OsFloatingIpPool extends OsResourceBase {
  description: string
}

export interface OsVolume extends OsResourceBase {
  size: number
  status: string
  volume_type: string
  bootable: boolean
}

export interface OsRouter extends OsResourceBase {
  status: string
  external_gateway_info: any
}

export interface OsAvailabilityZone extends OsResourceBase {
  state: string
}

// Discriminated union of supported resource types — must stay exactly in sync
// with ``backend/app/routers/apps.py:_OS_TYPES``.
export type OsResourceType =
  | 'network'
  | 'subnet'
  | 'flavor'
  | 'image'
  | 'keypair'
  | 'security_group'
  | 'floating_ip_pool'
  | 'volume'
  | 'router'
  | 'availability_zone'

// ----------------------------------------------------------------
// Endpoints
// ----------------------------------------------------------------
const base = (credentialId: string) =>
  `/me/openstack-credentials/${encodeURIComponent(credentialId)}/resources`

export const openstackResourcesApi = {
  listNetworks: (credentialId: string) => api.get<OsNetwork[]>(`${base(credentialId)}/networks`),

  listSubnets: (credentialId: string, networkId?: string) =>
    api.get<OsSubnet[]>(`${base(credentialId)}/subnets`, {
      params: networkId ? { network_id: networkId } : undefined,
    }),

  listFlavors: (credentialId: string) => api.get<OsFlavor[]>(`${base(credentialId)}/flavors`),

  listImages: (credentialId: string, statusFilter: string = 'active') =>
    api.get<OsImage[]>(`${base(credentialId)}/images`, {
      params: { status: statusFilter },
    }),

  listKeypairs: (credentialId: string) => api.get<OsKeypair[]>(`${base(credentialId)}/keypairs`),

  listSecurityGroups: (credentialId: string) =>
    api.get<OsSecurityGroup[]>(`${base(credentialId)}/security-groups`),

  listFloatingIpPools: (credentialId: string) =>
    api.get<OsFloatingIpPool[]>(`${base(credentialId)}/floating-ip-pools`),

  listVolumes: (credentialId: string) => api.get<OsVolume[]>(`${base(credentialId)}/volumes`),

  listRouters: (credentialId: string) => api.get<OsRouter[]>(`${base(credentialId)}/routers`),

  listAvailabilityZones: (credentialId: string, service: 'compute' | 'network' | 'volume' = 'compute') =>
    api.get<OsAvailabilityZone[]>(`${base(credentialId)}/availability-zones`, {
      params: { service },
    }),

  /** Cache-bust for the credential. ``kind`` optional, otherwise everything. */
  refresh: (credentialId: string, kind?: OsResourceType) =>
    api.post(`${base(credentialId)}/refresh`, null, {
      params: kind ? { kind } : undefined,
    }),
}
