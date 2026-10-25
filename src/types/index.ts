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

export type DeploymentStatus =
  | 'pending' | 'running' | 'success' | 'failed' | 'destroying' | 'destroyed' | 'cancelled'
  | 'pausing' | 'paused' | 'resuming' | 'pause_failed' | 'resume_failed'
  // A redeploy of one VM (or restart/reset of one pod workload) in flight / failed;
  // the rest of the deployment keeps running.
  | 'redeploying' | 'redeploy_failed'

/** How a deployment runs: pods in the cluster, KubeVirt VMs in the cluster; ``openstack-vm`` only on legacy rows. */
export type DeploymentRuntime = 'kubernetes' | 'kubevirt-vm' | 'openstack-vm'

/** Lifecycle actions the API allows right now (``DeploymentDetail.actions``). */
export type DeploymentAction = 'destroy' | 'delete' | 'pause' | 'resume' | 'cancel' | 'redeploy'

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
  // An admin deactivated the app; only an admin can make it public again.
  hidden_by_admin?: boolean
  // An admin recommends the app; the catalog opens on the "recommended" filter.
  recommended?: boolean
  // Version tag teachers deploy; set by an admin, null/absent means none set.
  deploy_version?: string | null
}

/**
 * ``GET /apps/{id}/runtime?version=``: how one version runs. ``scope`` is
 * ``team`` (one workload per team) or ``user`` (one per person).
 */
export interface AppRuntime {
  runtime: DeploymentRuntime
  scope?: 'team' | 'user' | null
  egress?: 'none' | 'internet' | null
  access?: Array<Record<string, unknown>>
  // Containers whose cpu/memory a person may choose (``resourceBounds`` in appstore.yaml).
  resources?: ResourceChoice[]
  // Network settings the app author lets people change (``userChoices`` in appstore.yaml);
  // only the allowed keys are present, ``default`` is the author's value.
  network?: NetworkChoices
}

/** One network setting an app offers; ``default`` is the start position in the wizard. */
export interface NetworkSetting {
  default: boolean
}

export interface NetworkChoices {
  internet?: NetworkSetting
  podNetwork?: NetworkSetting
}

/** The network settings a person chose; sent as ``userInputVar.network``. */
export interface NetworkSelection {
  internet?: boolean
  podNetwork?: boolean
}

export interface ResourceRange {
  default: string
  min: string
  max: string
}

/** What one container offers: default and range of its cpu and memory limits. */
export interface ResourceChoice {
  container: string
  cpu: ResourceRange
  memory: ResourceRange
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
  // What the review covers: the commit the tag pointed to at submission and,
  // for pod apps, the SHA-256 of its appstore.yaml and its image digests.
  commit_sha?: string | null
  runtime?: DeploymentRuntime
  spec_sha256?: string | null
  image_digests?: string[] | null
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
  userInputVar: string | null
  releaseTag: string
  // The commit every job of the deployment runs.
  commit_sha?: string | null
  runtime?: DeploymentRuntime
  created_at: string
}

/** What the caller may do with a deployment, decided by the API. */
export interface DeploymentPermissions {
  // Tasks, logs, live stream, infrastructure, redacted outputs.
  owner_view: boolean
  // Pause, resume, destroy, redeploy, cancel.
  operate: boolean
  // In one of its teams: own access via ``my-access``.
  member: boolean
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
  // by the Teams card on the deployment detail page.
  teams?: DeploymentTeam[];
  outputs?: any;
  logs?: string | null;
  permissions?: DeploymentPermissions;
  actions?: DeploymentAction[];
}

// One member's access credentials, mirroring the raw terraform
// ``user_accounts`` entry shape. Returned (filtered to the caller's
// own entry) by the ``/deployments/{id}/my-access`` endpoint so a
// team member can see their own credentials without the owner view.
export interface DeploymentUserAccount {
  username?: string | null;
  team?: string;
  // Pod apps: whose account and which workload it opens.
  user_id?: string;
  workload?: string;
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
  team_vms: Record<string, { url?: string | null; floating_ip?: string; fixed_ip?: string; workloads?: string[] }>;
}

export interface DeploymentCreate {
  name: string
  appId: string
  commitHash?: string | null
  commitInfo?: string | null
  userInputVar?: Record<string, any> | null
  releaseTag: string
  teams?: Array<{ name: string; userIds: string[] }>
  // Files-map keyed by the name of a ``file`` variable. Inner key:
  //   * scope = all  → exactly one inner key (conventionally "all")
  //   * scope = team → one entry per team name
  //   * scope = user → one entry per ``Team-User`` composite key
  // The wizard owns the keys; the backend persists the map verbatim
  // into ``userInputVar.terraform``.
  files?: Record<string, Record<string, DeploymentFile>>
}

/**
 * One uploaded file as it travels from wizard → POST /deployments
 * → backend persistence → the workload's files. ``content_b64`` is the
 * raw base64 payload (no ``data:...,`` wrapper).
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
// POD WORKLOAD TYPES
// ----------------------------------------------------------------

/** One workload (team or person) of a pod deployment, read live from the cluster. */
export interface PodWorkload {
  workload: string
  team: string | null
  /** ``scope: user``: whose workload it is. */
  user_id: string | null
  ready: boolean
  restarts: number
  /** Running, Pending, Stopped, CrashLoopBackOff, ImagePullBackOff, Unschedulable, ... */
  phase: string
  url: string | null
  lastEvent: string | null
  /** An app that sets itself up after it started (an installer) reports how far it is; null otherwise. */
  setup?: PodSetupProgress | null
}

export interface PodSetupProgress {
  percent: number
  step?: string | null
  /** Seconds the app expects to need still; null when it cannot tell yet. */
  etaSeconds?: number | null
}

export interface DeploymentResourceListResponse {
  /** ``true`` when the backend could ask the cluster. */
  live: boolean
  runtime?: DeploymentRuntime
  workloads?: PodWorkload[]
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
  // How the chosen version runs (``GET /apps/{id}/runtime``); null until known.
  runtime?: DeploymentRuntime | null
  // ``user``: one workload per person, the group step puts everyone in a team of their own.
  scope?: 'team' | 'user' | null
  // Pods: containers whose cpu/memory the app lets people choose; undefined until asked.
  resourceChoices?: ResourceChoice[]
  // The cpu/memory chosen per container; sent as ``userInputVar.resources``.
  resources?: Record<string, { cpu: string; memory: string }>
  // Pods: network settings the app lets people choose (from ``/runtime``) and the choice made.
  networkChoices?: NetworkChoices
  network?: NetworkSelection
  // Wizard-side state for ``file`` variables.
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
  // ``file`` (a file upload) or ``enum`` (one of ``values``); null or
  // undefined for free-text inputs.
  osType?: AppVariableOsType | null
  values?: string[]
  // Scope of a file variable. Set only when ``osType === 'file'``;
  // controls whether the wizard renders one FileDropZone, one per team, or one per user.
  osScope?: 'all' | 'team' | 'user'
  // Per-variable scope for all variables. 'all' = one shared value, 'team' = one
  // value per team, 'user' = one value per user (slot key ``TeamName-Username``).
  varScope?: 'all' | 'team' | 'user'
  // Allowed file extensions for file variables; used as the FileDropZone
  // ``accept`` attribute. The backend rejects other extensions with 422.
  fileExtensions?: string[]
  // Unused: the API no longer sends it (the Packer layout is gone). The wizard's
  // multi-image code (variableForm.ts, draft-variables.ts) still reads it until
  // it is removed in a follow-up.
  template_key?: string | null
}

// ``file``: rendered as a FileDropZone widget that produces a base64 payload
// shipped to the backend in ``DeploymentCreate.files``; ``osScope`` tells the
// wizard whether to render one zone, one per team, or one per user.
// ``enum`` (appstore.yaml): a choice among ``values``.
export type AppVariableOsType = 'file' | 'enum'
