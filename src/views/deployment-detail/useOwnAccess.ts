/**
 * The caller's own access data (issue 146). Members (the owner included, when in a
 * team) get their own access from `/my-access`, the only place credentials come
 * from: exactly their account entry, never a teammate's (.github#7 H), plus their
 * team's block. One member's credentials can be revealed on request (operate right).
 */
import { useCallback, useMemo, useState } from 'react'
import { useDeploymentStore } from '@/stores/deployment.store'
import { deploymentApi } from '@/api/deployment.api'
import { type AccountHit, type UserAccountMap, type TeamVmMap, teamVmsOf, ownAccountOf } from './helpers'
import { permissionsOf } from './access'
import type { DeploymentWithRelations } from '@/types'

export function useOwnAccess(deploymentId: string, outputs: DeploymentWithRelations['outputs']) {
  const [myAccounts, setMyAccounts] = useState<UserAccountMap | null>(null)
  const [myTeamVms, setMyTeamVms] = useState<TeamVmMap | null>(null)

  const loadMyAccess = useCallback(async () => {
    if (!permissionsOf(useDeploymentStore.getState().currentDeployment).member) return
    try {
      const { data } = await deploymentApi.getMyAccess(deploymentId)
      setMyAccounts((data.user_accounts ?? null) as UserAccountMap | null)
      setMyTeamVms(((data as { team_endpoints?: unknown }).team_endpoints ?? data.team_vms ?? null) as TeamVmMap | null)
    } catch (err) {
      console.error('Error loading own access credentials:', err)
    }
  }, [deploymentId])

  const teamVms = useMemo(() => teamVmsOf(outputs, myTeamVms), [outputs, myTeamVms])
  const ownAccount = useMemo(() => ownAccountOf(myAccounts), [myAccounts])

  // Returned to the caller, never kept here.
  const revealMemberAccess = useCallback(
    async (userId: string): Promise<AccountHit | null> => {
      const { data } = await deploymentApi.getMemberAccess(deploymentId, userId)
      return ownAccountOf((data.user_accounts ?? null) as UserAccountMap | null)
    },
    [deploymentId],
  )

  return { teamVms, ownAccount, loadMyAccess, revealMemberAccess }
}
