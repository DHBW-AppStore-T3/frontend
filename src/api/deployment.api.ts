import api from './axios'
import type {
  Deployment,
  DeploymentWithRelations,
  DeploymentCreate,
  DeploymentQueryParams,
  DeploymentResourceListResponse,
  MyAccessResponse,
} from '@/types'

// ----------------------------------------------------------------
// DEPLOYMENT API
// ----------------------------------------------------------------
export const deploymentApi = {
  /**
   * Get all deployments (filtered by role)
   */
  list: (params?: DeploymentQueryParams) => {
    return api.get<Deployment[]>('/deployments/', { params })
  },

  /**
   * Get deployment by ID with relations
   */
  getById: (deploymentId: string) => {
    return api.get<DeploymentWithRelations>(`/deployments/${deploymentId}`)
  },

  /**
   * Create deployment
   */
  create: (data: DeploymentCreate) => {
    return api.post<Deployment>('/deployments/', data)
  },

  /**
   * Delete a deployment.
   *
   * The backend picks the right behaviour based on status:
   *   * ``success``/``failed``/``paused`` → returns 202 ``{task_id, status}`` and
   *     dispatches a Destroy worker task; the SSE stream surfaces the
   *     terraform-destroy progress and the row is auto-soft-deleted on
   *     success.
   *   * ``cancelled`` → 204, immediate soft-delete (no resources to
   *     clean up).
   *   * anything in flight → 409.
   *
   * Callers should branch on ``response.status``: 202 means "watch the
   * live stream, eventually we get redirected", 204 means "done".
   */
  delete: (deploymentId: string) => {
    return api.delete(`/deployments/${deploymentId}`)
  },

  /**
   * Cancel an in-flight deployment and clean up after it.
   *
   * Owner-only, and the only action allowed while status is ``pending``
   * or ``running``. Returns 202 with ``{task_id, status: "destroying"}``,
   * so the caller attaches to the SSE stream exactly as it does for destroy.
   */
  cancel: (deploymentId: string) => {
    return api.post<{ task_id: string; status: 'destroying' }>(
      `/deployments/${deploymentId}/cancel`,
    )
  },

  pause: (deploymentId: string) => {
    return api.post<{ task_id: string; status: 'pausing' }>(
      `/deployments/${deploymentId}/pause`,
    )
  },

  /**
   * Resume a paused deployment.
   *
   * Owner-only. Allowed only when status is ``paused``. Same response
   * shape as ``pause`` but with ``status: "resuming"``.
   */
  resume: (deploymentId: string) => {
    return api.post<{ task_id: string; status: 'resuming' }>(
      `/deployments/${deploymentId}/resume`,
    )
  },

  /**
   * Fetch the CALLER'S OWN access credentials for a deployment.
   *
   * Member counterpart to the owner-only outputs: a team member
   * (student) gets only their own account, extracted server-side from
   * the latest successful deploy — teammates' credentials are never
   * included. The response mirrors the raw ``user_accounts`` /
   * ``team_vms`` shape (one key each) so the detail view's existing
   * account-matching consumes it unchanged.
   *
   * 200 with empty maps means "no credentials yet" (no successful
   * deploy, or the app issued no per-user account). 403 if the caller
   * has no access to the deployment.
   */
  getMyAccess: (deploymentId: string) => {
    return api.get<MyAccessResponse>(`/deployments/${deploymentId}/my-access`)
  },

  /**
   * The workloads of a pod deployment, read live from its namespace.
   * Owner view only.
   */
  listResources: (deploymentId: string) => {
    return api.get<DeploymentResourceListResponse>(`/deployments/${deploymentId}/resources`)
  },

  /**
   * Pod deployments: restart one team's or person's workload (a new pod);
   * its data stays. Operate right, only from ``success`` or
   * ``redeploy_failed``; 404 ``workload_not_found``. 202 like a redeploy.
   */
  restartWorkload: (deploymentId: string, workload: string) => {
    return api.post<{ task_id: string; status: 'redeploying' }>(
      `/deployments/${deploymentId}/workloads/${encodeURIComponent(workload)}/restart`,
    )
  },

  /**
   * Pod deployments: reset one workload — its volume is deleted and it
   * starts from scratch. Same rules as ``restartWorkload``.
   */
  resetWorkload: (deploymentId: string, workload: string) => {
    return api.post<{ task_id: string; status: 'redeploying' }>(
      `/deployments/${deploymentId}/workloads/${encodeURIComponent(workload)}/reset`,
    )
  },
}
