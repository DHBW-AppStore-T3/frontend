// ================================================================
// Backend Model Types
// ================================================================
//
// The types in the USER block below are DERIVED from the backend's
// OpenAPI schema (`api.generated.ts`, regenerate with
// `npm run gen:api-types`). They are not hand-written and must not be
// edited here.
//
// Everything else in this file is still hand-maintained, which is a
// known source of drift. Before this change the whole file was, and it
// had drifted in both directions: `UserUpdate` offered `email` and
// `username` that the backend stopped accepting when profile fields
// moved to Keycloak, while `User` was missing `keycloak_id`,
// `firstName` and `lastName` that the backend does return -- so the
// code needing those fields fell back to `any`. `UserCreate.password`
// and `UserPasswordUpdate` outlived the column that migration
// 2026_01_25_1609 dropped.
//
// Migrate the remaining blocks the same way as they are touched.
// ================================================================

import type { components } from './api.generated'

type Schemas = components['schemas']

// ----------------------------------------------------------------
// ENUMS
// ----------------------------------------------------------------
export type UserRole = Schemas['UserRole']

export type DeploymentStatus = 'pending' | 'running' | 'success' | 'failed' | 'destroying' | 'destroyed' | 'cancelled' | 'pausing' | 'paused' | 'resuming' | 'pause_failed' | 'resume_failed'

export type TaskType = 'deploy' | 'destroy' | 'update' | 'pause' | 'resume' | 'redeploy'

export type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled'

// ----------------------------------------------------------------
// USER TYPES
// ----------------------------------------------------------------
// Derived from the schema -- see the note at the top of this file.
// `User` carries keycloak_id / firstName / lastName, which the backend
// has always returned and the hand-written version omitted.
export type User = Schemas['UserResponse']
export type UserWithCourse = Schemas['UserWithCourse']
export type UserStatistics = Schemas['UserStatistics']

// Profile fields live in Keycloak; role and courseId are the only
// things this API updates, and role is admin-only.
export type UserUpdate = Schemas['UserUpdate']

// `UserCreate` and `UserPasswordUpdate` used to sit here. The backend
// has no create-user or change-password endpoint -- Keycloak owns both,
// and the users.password column was dropped in migration
// 2026_01_25_1609. Their only consumers were the dead api/auth.api.ts
// and userApi.changePassword.

// ----------------------------------------------------------------
// COURSE TYPES
// ----------------------------------------------------------------
export interface Course {
  courseId: string
  name: string
}

export interface CourseWithUsers extends Course {
  users: User[]
}

export interface CourseCreate {
  name: string
}

export interface CourseUpdate {
  name?: string
}

// ----------------------------------------------------------------
// APP TYPES
// ----------------------------------------------------------------
export interface App {
  appId: string
  name: string
  description: string | null
  git_link: string | null
  userId: string
  created_at: string
  releaseTag: string
  is_private: boolean
  // Data-URL ("data:image/png;base64,...") or null when the app
  // has no logo. Goes straight into ``<img :src=...>``.
  image?: string | null
}

export interface AppWithUser extends App {
  user: User
}

export interface AppCreate {
  name: string
  description?: string | null
  git_link?: string | null
  releaseTag?: string
  is_private?: boolean
  submit_all_versions?: boolean
  // Data-URL of the logo. Use the FileReader.readAsDataURL output.
  // Omit / null = no logo.
  image?: string | null
}

export interface AppUpdate {
  name?: string
  description?: string | null
  is_private?: boolean
  // Data-URL ("data:image/...;base64,..."), empty string to clear
  // the existing image, or undefined to leave unchanged.
  image?: string | null
}

// ----------------------------------------------------------------
// APP VERSION APPROVAL TYPES
// ----------------------------------------------------------------
export type AppVersionApprovalStatus = 'pending' | 'approved' | 'rejected'

export type AppVersionBadgeStatus = 'new' | 'pending' | 'approved' | 'published' | 'rejected' | 'private'

export interface AppVersionApproval {
  approvalId: string
  appId: string
  version_tag: string
  status: AppVersionApprovalStatus
  diff_url: string | null
  notes: string | null
  rejection_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface AppVersionApprovalWithApp extends AppVersionApproval {
  app: App
}

// ----------------------------------------------------------------
// DEPLOYMENT TYPES
// ----------------------------------------------------------------
export interface Deployment {
  deploymentId: string
  name: string
  appId: string
  userId: string
  status: DeploymentStatus
  commitHash: string | null
  commitInfo: string | null
  userInputVar: string | null
  releaseTag: string
  created_at: string
}

export interface DeploymentTeamMember {
  userId: string
  email: string
  username: string
}

export interface DeploymentTeam {
  teamId: string
  name: string
  members: DeploymentTeamMember[]
}

export interface DeploymentWithRelations extends Deployment {
  user: User
  app: App
  latest_task?: {
    taskId: string;
    type: string;
    status: string;
    started_at: string | null;
    finished_at: string | null;
    created_at: string;
  } | null;
  // Teams + members from the DeploymentDetail backend response. Used
  // by the Teams card on the deployment detail page (resend-access
  // buttons hang off of these IDs).
  teams?: DeploymentTeam[];
  outputs?: any;
  logs?: string | null;
}

// One member's access credentials, mirroring the raw terraform
// ``user_accounts`` entry shape. Returned (filtered to the caller's
// own entry) by the ``/deployments/{id}/my-access`` endpoint so a
// team member can see their own credentials without the owner view.
export interface DeploymentUserAccount {
  username: string;
  team?: string;
  ip?: string;
  port?: number;
  auth?: string;
  type?: 'password' | 'ssh_key' | 'oauth' | 'none' | string;
  authtype?: 'ssh' | 'url' | 'rdp' | string;
  url?: string;
}

// Response of ``GET /deployments/{id}/my-access``. Both maps carry at
// most one key (the caller's own account / their team's VM), in the
// same shape as ``outputs.user_accounts.value`` so the detail view's
// existing account-matching pipeline consumes it unchanged. Empty maps
// mean "no credentials yet".
export interface MyAccessResponse {
  user_accounts: Record<string, DeploymentUserAccount>;
  team_vms: Record<string, { url?: string; floating_ip?: string; fixed_ip?: string }>;
}

export interface DeploymentCreate {
  name: string
  appId: string
  commitHash?: string | null
  commitInfo?: string | null
  userInputVar?: Record<string, any> | null
  releaseTag: string
  teams?: Array<{ name: string; userIds: string[] }>
  // Files-map keyed by ``@openstack:file:<scope>``-marked variable
  // name. Inner key:
  //   * scope = all  → exactly one inner key (conventionally "all")
  //   * scope = team → one entry per team name
  //   * scope = user → one entry per ``Team-User`` composite key
  // The wizard owns the keys; the backend persists the map verbatim
  // into ``userInputVar.terraform`` so the worker can pass it through
  // to terraform as a typed map.
  files?: Record<string, Record<string, DeploymentFile>>
}

/**
 * One uploaded file as it travels from wizard → POST /deployments
 * → backend persistence → terraform variable. ``content_b64`` is the
 * raw base64 payload (no ``data:...,`` wrapper); the rest is the
 * metadata the user-data template needs to land the file on disk.
 */
export interface DeploymentFile {
  name: string
  content_b64: string
  size: number
  content_type?: string
}

export interface DeploymentUpdate {
  name?: string
  status?: DeploymentStatus
  commitHash?: string | null
  commitInfo?: string | null
  userInputVar?: string | null
}

// ----------------------------------------------------------------
// DEPLOYMENT INFRASTRUCTURE / RESOURCE TYPES
// ----------------------------------------------------------------
//
// Mirrors ``app/services/deployment_status.py`` and the schemas in
// ``app/schemas.py``. The list endpoint ships Stage-1 fields
// (lifecycle, hardware, addresses); the detail endpoint also fills
// the Stage-2 fields (ports, security_groups, volumes, metadata).

/** ``in_sync`` = TF-cached attrs match live OpenStack;
 *  ``stale``   = live fetch failed/timed out, fall back to cache;
 *  ``missing`` = live fetch confirmed the resource is gone. */
export type ResourceDrift = 'in_sync' | 'stale' | 'missing'

/** Coarse category the Infrastructure tab groups by. */
export type DeploymentResourceCategory =
  | 'instance'
  | 'network'
  | 'subnet'
  | 'security_group'
  | 'floating_ip'
  | 'port'

export interface LifecycleStates {
  /** OpenStack server ``status``, e.g. ``ACTIVE``/``BUILD``/``ERROR``. */
  status: string | null
  /** Transient action, e.g. ``spawning``/``networking``/``deleting``. */
  task_state: string | null
  vm_state: string | null
  /** Nova power-state already translated to label
   *  (``RUNNING``/``SHUTDOWN``/``CRASHED``/...). */
  power_state: string | null
  /** Filled when ``status === 'ERROR'`` — the underlying Nova fault
   *  message. UI shows it as a red banner under the VM card. */
  fault_message: string | null
}

export interface HardwareSpec {
  flavor_name: string | null
  ram_mb: number | null
  vcpus: number | null
  disk_gb: number | null
  image_id: string | null
  /** Stage-1 leaves this null (no extra API hop); Stage-2 resolves it. */
  image_name: string | null
  availability_zone: string | null
  /** ISO-8601 timestamp; frontend computes uptime against ``Date.now()``. */
  launched_at: string | null
}

export interface NetworkAddress {
  network: string
  fixed_ip: string | null
  floating_ip: string | null
  mac: string | null
}

export interface NetworkPort {
  port_id: string
  network_id: string | null
  status: string | null
  mac: string | null
  fixed_ip: string | null
  security_group_ids: string[]
}

export interface SecurityGroupSummary {
  id: string
  name: string
  description: string | null
  ingress_rules: number
  egress_rules: number
}

export interface VolumeAttachment {
  volume_id: string
  device: string | null
  size_gb: number | null
  bootable: boolean | null
  status: string | null
  name: string | null
}

export interface DeploymentResource {
  /** Terraform state address — round-trippable to the redeploy endpoint. */
  address: string
  /** Raw HCL resource type, e.g. ``openstack_compute_instance_v2``. */
  type: string
  category: DeploymentResourceCategory
  team: string | null
  provider_id: string
  display_name: string
  drift: ResourceDrift
  // Stage-1 (instance-only)
  lifecycle: LifecycleStates | null
  hardware: HardwareSpec | null
  addresses: NetworkAddress[]
  // Stage-2 (instance-only, only populated on the detail endpoint)
  ports?: NetworkPort[] | null
  security_groups?: SecurityGroupSummary[] | null
  volumes?: VolumeAttachment[] | null
  metadata?: Record<string, string> | null
}

export interface DeploymentResourceListResponse {
  resources: DeploymentResource[]
  /** ``true`` when the backend overlaid live OpenStack data;
   *  ``false`` when ``refresh=false`` was requested. */
  live: boolean
}

// ----------------------------------------------------------------
// TASK TYPES
// ----------------------------------------------------------------
export interface TaskLogEntry {
  timestamp: string
  level: string
  category?: string
  message: string
  [key: string]: any // Allow additional fields like operation, resource_type, etc.
}

export interface TaskLogsObject {
  error?: string
  deployment_id?: string
  logs?: TaskLogEntry[]
  tf_state?: any
  commit_info?: any
  terraform_outputs?: any
}

export interface Task {
  taskId: string
  deploymentId: string
  celeryTaskId: string
  type: TaskType
  status: TaskStatus
  started_at: string | null
  finished_at: string | null
  logs: string | TaskLogsObject | null
  tf_state: string | object | null
  outputs: string | object | null
  // Live-progress fields. Backend persists them while the worker is
  // running so a page reload mid-deploy shows the last known phase
  // and percent without waiting for the next SSE event.
  current_phase: string | null
  progress_pct: number | null
  created_at: string
}

// ----------------------------------------------------------------
// AUTH TYPES
// ----------------------------------------------------------------

// ----------------------------------------------------------------
// API RESPONSE TYPES
// ----------------------------------------------------------------
export interface ApiError {
  detail: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
}

// ----------------------------------------------------------------
// QUERY PARAMS
// ----------------------------------------------------------------
export interface PaginationParams {
  skip?: number
  limit?: number
}

export interface UserQueryParams extends PaginationParams {
  role?: UserRole
  courseId?: string
}

export interface AppQueryParams extends PaginationParams {
  userId?: string
}

export interface DeploymentQueryParams extends PaginationParams {
  userId?: string
  appId?: string
  status?: DeploymentStatus
}


// ================================================================
// FRONTEND UI TYPES (Wizard State & Helper)
// ================================================================

// Extended app configuration for the UI (summary view).
export interface AppUIConfig {
  flavor: string      // e.g. "m1.medium"
  image: string       // e.g. "kali:latest"
  ports: string       // e.g. "22, 8080"
  network: string     // e.g. "Isolated VLAN"
  software: string    // e.g. "Wireshark"
  secGroup?: string   // e.g. "SSH only"
  storage?: string    // e.g. "40 GB"
}

// Backend app type extended for use in the store.
export interface AppDefinition extends App {
  defaultConfig?: AppUIConfig
  // Icon name string for Lucide icons (e.g. "Terminal", "ShieldAlert").
  iconStr?: string
}

// Wizard state (the "cart" before submission).
export type GroupMode = 'one' | 'eachUser' | 'custom'

export interface DeploymentDraft {
  // Step 1: app selection
  appId: string | null

  // Step 2: base configuration
  name: string
  courseIds: string[]    // multiple courses possible
  studentIds: string[]   // selected student IDs

  // Step 3: group count
  groupMode: GroupMode
  groupCount: number,
  userInputVar: Record<string, any> | string // object or JSON string

  // Step 4: assignment (which user is in which group).
  // Key = group index (0, 1, 2...), value = array of user IDs.
  assignments: Record<number, string[]>
  releaseTag: string
  variables: Record<string, any> // parsed/merged variables
  version: string
  groupNames: string[]
  variableDefinitions?: AppVariable[] // API definitions for the variables
  // Wizard-side state for ``@openstack:file:<scope>``-marked variables.
  // Outer key: variable name. Inner key: scope routing token (``"all"``,
  // team name, or ``Team-User`` composite). Flushed verbatim into
  // ``DeploymentCreate.files`` on submit.
  fileUploads?: Record<string, Record<string, DeploymentFile>>
}

// Helper type for the final summary.
export interface WizardSummary {
  appName: string
  deploymentName: string
  totalStudents: number
  totalGroups: number
  config: AppUIConfig | undefined
}

export interface AppVariable {
  name: string
  type: string
  description?: string
  // Backend coerces the HCL default literal to its native Python type
  // (number, bool, list/set/tuple → Array, map → Object, null). A null
  // default also makes the variable required. Strings stay unquoted strings.
  default?: string | number | boolean | unknown[] | Record<string, unknown> | null
  required?: boolean
  source?: 'terraform' | 'packer' | 'unknown'
  // Value-help metadata, set by the backend when the variable carries an
  // ``@openstack:<type>[:<mode>][:<multi>]`` marker. Undefined for free-text inputs.
  osType?: AppVariableOsType
  // 'id' (UUID) or 'name'; defaults to 'name' for most resource kinds.
  osMode?: 'id' | 'name'
  // Multi-select, from the marker or derived from the HCL list/set type.
  osMulti?: boolean
  // Scope for ``@openstack:file:<scope>``. Set only when ``osType === 'file'``;
  // controls whether the wizard renders one FileDropZone, one per team, or one per user.
  osScope?: 'all' | 'team' | 'user'
  // Per-variable scope for all variables. 'all' = one shared value, 'team' = one
  // value per team, 'user' = one value per user (slot key ``TeamName-Username``).
  varScope?: 'all' | 'team' | 'user'
  // Allowed file extensions for file variables; used as the FileDropZone
  // ``accept`` attribute. The backend rejects other extensions with 422.
  fileExtensions?: string[]
  // Marker error set by the backend when a variable's ``@openstack`` marker is
  // malformed. The frontend shows it as an inline banner and falls back to free text.
  markerError?: AppVariableMarkerError
  // Multi-image apps: key of the Packer template this variable belongs to
  // (for ``source === 'packer'``). Single-template apps use the sentinel
  // ``"default"``; Terraform variables leave this null/undefined.
  template_key?: string | null
}

export interface AppVariableMarkerError {
  variable: string
  message: string
  // ``terraform/variables.tf:42``-style hint pointing app authors to the marker location.
  location?: string
  // Stable error codes (e.g. ``MARKER_WHITESPACE``, ``MARKER_UNKNOWN_OS_TYPE``)
  // set alongside the ``message`` so the frontend can i18n without string matching.
  code?: string
}

// ----------------------------------------------------------------
// OPENSTACK DISPLAY-CACHE TYPES
// ----------------------------------------------------------------
/**
 * Return shape of ``useOpenStackResourceCache.getDisplayName``.
 *
 * ``known = true`` means the value was found in the cache and ``name`` is the
 * human-readable label; ``known = false`` means the caller should render the raw value.
 * ``modeMismatch = true`` means the value was found in the other mode (e.g. a UUID
 * stored while the default is a name), which callers can surface as a subtle hint.
 */
export interface OpenStackDisplayName {
  name: string
  known: boolean
  modeMismatch?: boolean
}

// List of supported OpenStack resource types. Must stay consistent with:
//  - backend/app/routers/apps.py (``_OS_TYPES``)
//  - backend/app/routers/openstack_resources.py (list endpoints)
//  - frontend/src/api/openstack-resources.api.ts (``OsResourceType``)
//  - frontend/src/components/OpenStackResourcePicker.vue (render)
export type AppVariableOsType =
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
  // ``file`` is a pseudo-resource: rendered as a FileDropZone widget that
  // produces a base64 payload shipped to the backend in ``DeploymentCreate.files``.
  // ``osScope`` tells the wizard whether to render one zone, one per team, or one per user.
  | 'file'