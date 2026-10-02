import api from './axios'
import type {
  Deployment,
  DeploymentWithRelations,
  DeploymentCreate,
  DeploymentQueryParams,
  DeploymentResourceListResponse,
  DeploymentResource,
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
   * Pause a running deployment.
   *
   * Halts the OpenStack compute instances of the deployment without
   * tearing them down — volumes and networks are preserved so resume
   * restores the same instances byte-for-byte.
   *
   * Owner-only. Allowed only when status is ``success``. Returns 202
   * with ``{task_id, status: "pausing"}``; the frontend should attach
   * to the SSE stream just like for delete/destroy.
   */
  /**
   * Cancel an in-flight deployment and clean up after it.
   *
   * Owner-only, and the only action allowed while status is ``pending``
   * or ``running``. The backend revokes the worker task and then runs a
   * destroy that additionally reaps the Packer build instance - which
   * lives outside Terraform state and would otherwise keep running.
   *
   * Returns 202 with ``{task_id, status: "destroying"}``, so the caller
   * attaches to the SSE stream exactly as it does for destroy.
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
   * Re-send the per-user access mail for one team member of a
   * deployment. Reuses the credentials from the latest successful
   * DEPLOY task's terraform outputs, so this only works after a
   * deploy has completed. 409 if there's nothing to resend yet,
   * 502 if SMTP rejected the mail.
   */
  resendAccess: (deploymentId: string, teamId: string, userId: string) => {
    return api.post(
      `/deployments/${deploymentId}/teams/${teamId}/users/${userId}/resend-access`,
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
   * List the deployment's infrastructure resources (Stage-1 view).
   *
   * Parses the most-recent task's cached Terraform state and (by
   * default) overlays a live OpenStack fetch per compute instance so
   * the UI sees the ECHTEN power state, fault message, IPs, etc.
   *
   * Pass ``refresh=false`` to skip the live fetch — useful during
   * tight polling loops (the cached state still reflects what
   * terraform last wrote, just not the post-apply lifecycle).
   *
   * Owner-only. 412 when the user has no OpenStack credentials,
   * 502 when OpenStack itself is unreachable.
   */
  listResources: (deploymentId: string, options?: { refresh?: boolean }) => {
    return api.get<DeploymentResourceListResponse>(
      `/deployments/${deploymentId}/resources`,
      { params: { refresh: options?.refresh ?? true } },
    )
  },

  /**
   * Stage-2 detail for a single compute instance, by Terraform state
   * address. The address is the same string ``terraform state list``
   * prints — for the typical ``for_each = toset(teams)`` shape that
   * means ``openstack_compute_instance_v2.team_ide["Team-A"]``.
   *
   * Loaded lazily by the drawer in ``InfrastructureVmCard`` when the
   * user clicks "Details". Adds ports, security-group summaries,
   * volume attachments, the resolved image name, and the full
   * metadata map on top of the stage-1 fields.
   */
  getResourceDetail: (deploymentId: string, address: string) => {
    return api.get<DeploymentResource>(
      `/deployments/${deploymentId}/resources/${encodeURIComponent(address)}`,
    )
  },

  /**
   * Replace a single compute instance via
   * ``terraform apply -replace=<addr> -target=<addr>``. Spawns a
   * dedicated ``REDEPLOY`` Celery task — the SSE stream picks it
   * up just like deploy/destroy/pause/resume.
   *
   * Backend enforces that the address is a known compute-instance
   * in the cached state; anything else is 422 (non_redeployable_
   * resource_type) so the UI can surface a clear "you can only
   * redeploy VMs" message. Returns 202 with ``{task_id, status:
   * 'redeploying'}``.
   */
  redeployResource: (deploymentId: string, address: string) => {
    return api.post<{ task_id: string; status: 'redeploying' }>(
      `/deployments/${deploymentId}/resources/${encodeURIComponent(address)}/redeploy`,
    )
  },
}
