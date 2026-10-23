import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  useOpenStackCredentialsStore,
  selectUsableCredentials,
  selectIsResolved,
} from '@/stores/openstack-credentials.store'
import { useQuotas } from '@/composables/useQuotas'
import { chooseQuotaCredential } from './quotaCredential'

/**
 * Keeps the quota tile on a usable credential's project. OpenStack
 * credentials and quotas only concern teachers and admins who run VM apps;
 * pod apps need neither, students never.
 */
export function useQuotaCredential(enabled: boolean) {
  const quotas = useQuotas()
  const { credentialId, selectCredential, fetchQuotas } = quotas
  const isResolved = useOpenStackCredentialsStore(selectIsResolved)
  const usable = useOpenStackCredentialsStore(useShallow(selectUsableCredentials))
  const chosenId = chooseQuotaCredential(credentialId, usable)

  useEffect(() => {
    if (enabled && !useOpenStackCredentialsStore.getState().credentials) {
      void useOpenStackCredentialsStore.getState().fetch()
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !isResolved) return
    selectCredential(chosenId)
    if (chosenId) void fetchQuotas()
  }, [enabled, isResolved, chosenId, selectCredential, fetchQuotas])

  return { ...quotas, usable, isResolved }
}
