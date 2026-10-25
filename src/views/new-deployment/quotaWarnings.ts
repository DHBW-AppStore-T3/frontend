import { useEffect } from 'react'
import { useQuotas, useQuotaStore, type QuotaRow } from '@/composables/useQuotas'

export const QUOTA_WARNING_THRESHOLD = 75

export function getQuotaWarnings(rows: QuotaRow[]): QuotaRow[] {
  return rows.filter((r) => r.limit !== null && r.percentage >= QUOTA_WARNING_THRESHOLD)
}

/**
 * Fetches quota data for the given credential and returns rows that exceed the
 * warning threshold. Intended for the VM deployment wizard so the instructor
 * sees quota pressure before submitting.
 */
export function useDeploymentQuotaWarnings(credentialId: string | null) {
  const { formattedQuotas, loading, error, selectCredential, fetchQuotas } = useQuotas()

  useEffect(() => {
    selectCredential(credentialId)
  }, [credentialId])

  useEffect(() => {
    const storeId = useQuotaStore.getState().credentialId
    if (storeId) void fetchQuotas()
  }, [credentialId])

  return {
    warnings: getQuotaWarnings(formattedQuotas),
    loading,
    error,
  }
}
