// ================================================================
// Backend Model Types
// ================================================================
//
// The types in the USER, COURSE, APP, APP VERSION APPROVAL, DEPLOYMENT, POD WORKLOAD
// and TASK blocks below
// are DERIVED from the backend's OpenAPI schema (`api.generated.ts`,
// regenerate with `npm run gen:api-types`). They are not hand-written and
// must not be edited here. Where one differs from the schema on purpose
// (a narrower literal type, a field the UI still reads that the schema
// lacks), the reason is written next to it.
//
// What is still hand-written (AppRuntime and its resource/network helpers, the
// wizard state, variables, filters) says why next to it. Before the migration the
// whole file was hand-written, and it had drifted in both directions: `UserUpdate` offered `email` and
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

/** How a deployment runs: pods in the cluster, or KubeVirt VMs in the cluster. */
export type DeploymentRuntime = 'kubernetes' | 'kubevirt-vm'

/** Lifecycle actions the API allows right now (``DeploymentDetail.actions``). */
export type DeploymentAction = 'destroy' | 'delete' | 'pause' | 'resume' | 'cancel' | 'redeploy'

export type TaskType = Schemas['TaskType']

export type TaskStatus = Schemas['TaskStatus']

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
export type Course = Schemas['CourseResponse']

// ``users`` is optional in the schema (it defaults to an empty list).
export type CourseWithUsers = Schemas['CourseWithUsers']

export type CourseCreate = Schemas['CourseCreate']

export type CourseUpdate = Schemas['CourseUpdate']

// ----------------------------------------------------------------
// APP TYPES
// ----------------------------------------------------------------
// Derived from ``AppResponse`` (frontend#87). The hand-written type also had a
// required ``releaseTag``; the API never returns one on an app (it is a field of
// deployments and of the entries in ``AppDetail.versions``) and nothing read it.
// Beware: ``image`` is a Data-URL ("data:image/png;base64,...") or null.
export type App = Schemas['AppResponse']

/**
 * ``GET /apps/{id}/runtime?version=``: how one version runs.
 *
 * Stays hand-written on purpose: ``AppRuntimeResponse`` types ``runtime``, ``scope`` and
 * ``egress`` as plain strings and ``access`` / ``resources`` / ``network`` as open
 * records, while the UI relies on the known values and on the shapes of the
 * ``ResourceChoice`` / ``NetworkChoices`` helpers below (they describe the
 * ``appstore.yaml`` contents, which the OpenAPI schema does not model).
 * ``scope`` is
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

/** ``App`` plus its owner, as ``GET /apps/{id}`` returns it (minus ``versions``, see ``AppDetail``). */
export type AppWithUser = App & { user: User }

// ``releaseTag`` was offered by the hand-written type but is not part of
// ``AppCreate`` and the form never sent it. The schema lists ``is_private`` and
// ``submit_all_versions`` as required (they have backend defaults; the generator
// treats defaults as required) while the hand-written type had them optional --
// the only caller, ``buildCreatePayload``, always sends both.
// ``image``: Data-URL of the logo (FileReader.readAsDataURL output); omit / null = no logo.
export type AppCreate = Schemas['AppCreate']

// ``image``: Data-URL, an empty string clears the existing image, undefined leaves it unchanged.
export type AppUpdate = Schemas['AppUpdate']

// ----------------------------------------------------------------
// APP VERSION APPROVAL TYPES
// ----------------------------------------------------------------
export type AppVersionApprovalStatus = Schemas['AppVersionApprovalStatus']

export type AppVersionBadgeStatus = 'new' | 'pending' | 'approved' | 'published' | 'rejected' | 'private'

// Derived from ``AppVersionApprovalResponse`` (frontend#87). ``runtime`` is narrowed
// from ``string`` to the known values like in ``Deployment``. What the review covers:
// the commit the tag pointed to at submission and, for pod apps, the SHA-256 of its
// appstore.yaml and its image digests.
export type AppVersionApproval = Omit<Schemas['AppVersionApprovalResponse'], 'runtime'> & {
  runtime: DeploymentRuntime
}

export type AppVersionApprovalWithApp = AppVersionApproval & { app: App }

// ----------------------------------------------------------------
// DEPLOYMENT TYPES
// ----------------------------------------------------------------
// Derived from ``DeploymentResponse`` (frontend#86). On purpose narrower than
// the schema: ``status`` and ``runtime`` are ``string`` there, the UI relies on
// the known values. The schema also has ``userInputVar`` as an object (the
// hand-written type said ``string | null``) and ``releaseTag`` / ``created_at``
// as optional.
export type Deployment = Omit<Schemas['DeploymentResponse'], 'status' | 'runtime'> & {
  status: DeploymentStatus
  runtime?: DeploymentRuntime
}

/** What the caller may do with a deployment, decided by the API. */
export type DeploymentPermissions = Schemas['DeploymentPermissions']

export type DeploymentTeamMember = Schemas['DeploymentTeamMember']

export type DeploymentTeam = Schemas['DeploymentTeamResponse']

// Derived from ``DeploymentDetail``. ``status``, ``runtime`` and ``actions`` are
// narrowed to the known values like in ``Deployment``; ``app`` is the schema's
// ``AppResponse``, i.e. ``App`` (frontend#87). ``outputs``
// is the schema's ``DeploymentOutputs`` (``raw``) instead of ``any``.
export type DeploymentWithRelations = Omit<Schemas['DeploymentDetail'], 'status' | 'runtime' | 'actions'> & {
  status: DeploymentStatus
  runtime?: DeploymentRuntime
  actions: DeploymentAction[]
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
// The schema types both maps loosely (``unknown`` values) and has a third map,
// ``team_endpoints``, that this type does not list (``useDeploymentDetail`` reads
// it next to ``team_vms``); kept hand-written until the account shapes are
// pinned down in the schema.
export interface MyAccessResponse {
  user_accounts: Record<string, DeploymentUserAccount>;
  team_vms: Record<string, { url?: string | null; floating_ip?: string; fixed_ip?: string; workloads?: string[] }>;
}

// Derived from ``DeploymentCreate``; ``files`` is a loose ``object`` in the schema.
export type DeploymentCreate = Omit<Schemas['DeploymentCreate'], 'files'> & {
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
export type DeploymentFile = Schemas['DeploymentFileUpload']

// No schema: the backend has no ``DeploymentUpdate`` and nothing in the frontend
// uses this type. Kept (exported name) until it is removed on purpose.
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
export type PodWorkload = Schemas['PodWorkloadSchema']

export type PodSetupProgress = Schemas['PodSetupProgress']

export type DeploymentResourceListResponse = Schemas['DeploymentResourceListResponse']

// ----------------------------------------------------------------
// TASK TYPES
// ----------------------------------------------------------------
export interface TaskLogEntry {
  timestamp: string
  level: string
  category?: string
  message: string
  [key: string]: unknown // Allow additional fields like operation, resource_type, etc.
}

export interface TaskLogsObject {
  error?: string
  deployment_id?: string
  logs?: TaskLogEntry[]
  tf_state?: unknown
  commit_info?: unknown
  terraform_outputs?: unknown
}

// Derived from ``TaskResponse``. ``logs`` is ``string | null`` in the schema; the
// frontend also reads structured logs (``logEntryCount``, ``splitTaskLogs`` and the
// test fixtures handle an object), so the object form stays accepted.
export type Task = Omit<Schemas['TaskResponse'], 'logs'> & {
  logs: string | TaskLogsObject | null
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
  // A readable title for people. The apps do not send one yet; the wizard then derives a title from ``name``.
  label?: string
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
  // controls whether the wizard offers one file for everybody, one per team, or one per user.
  osScope?: 'all' | 'team' | 'user'
  // Per-variable scope for all variables. 'all' = one shared value, 'team' = one
  // value per team, 'user' = one value per user (slot key ``TeamName-Username``).
  varScope?: 'all' | 'team' | 'user'
  // Allowed file extensions for file variables; used as the ``accept`` attribute and to check a file
  // when it is picked. The backend rejects other extensions with 422.
  fileExtensions?: string[]
}

// ``file``: rendered as a FileVariableCard that produces base64 payloads shipped to
// the backend in ``DeploymentCreate.files``; ``osScope`` tells the wizard whether the
// file is for the whole deployment, per team, or per user.
// ``enum`` (appstore.yaml): a choice among ``values``.
export type AppVariableOsType = 'file' | 'enum'
