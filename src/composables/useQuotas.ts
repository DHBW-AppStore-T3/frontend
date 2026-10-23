import { useMemo } from 'react'
import { create } from 'zustand'
import { Cpu, HardDrive, Network, Box, Layers, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { quotasApi } from '@/api/quotas.api'
import type { QuotaOverview } from '@/types/quota'

// ----------------------------------------------------------------
// MODULE-SCOPED STATE (shared across all consumers)
// ----------------------------------------------------------------
// Quotas belong to the OpenStack project behind one of the caller's
// credentials; the dashboard tile shows the one the user picked.
//
// Why module-scoped: the dashboard mounts/unmounts whenever the user
// navigates, but we want the quota tile to keep showing the last known
// numbers while the next fetch is in flight instead of flashing the
// loading skeleton again. sessionStorage extends that across reloads
// inside the same browser session, per credential.
const STORAGE_PREFIX = 'openstack.quotas.v2.'
const MB_PER_GB = 1024 // OpenStack reports RAM in MB

const COLOR_THRESHOLDS: Array<[minPercentage: number, cssClass: string]> = [
  [90, 'bg-red-500'],
  [75, 'bg-orange-500'],
  [50, 'bg-yellow-500'],
]
const COLOR_DEFAULT = 'bg-green-500'

function readCachedQuotas(credentialId: string | null): QuotaOverview | null {
  if (!credentialId) return null
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + credentialId)
    return raw ? (JSON.parse(raw) as QuotaOverview) : null
  } catch {
    return null
  }
}

function writeCachedQuotas(credentialId: string, value: QuotaOverview | null) {
  try {
    if (value) sessionStorage.setItem(STORAGE_PREFIX + credentialId, JSON.stringify(value))
    else sessionStorage.removeItem(STORAGE_PREFIX + credentialId)
  } catch {
    // sessionStorage may be unavailable (private mode, quota) — degrade silently
  }
}

interface QuotaState {
  credentialId: string | null
  quotas: QuotaOverview | null
  loading: boolean
  error: string | null
}

export const useQuotaStore = create<QuotaState>()(() => ({
  credentialId: null,
  quotas: null,
  loading: false,
  error: null,
}))

// An unlimited quota (-1) never fills up.
const getPercentage = (used: number, limit: number): number =>
  limit <= 0 ? 0 : Math.round((used / limit) * 100)

const getColorClass = (percentage: number): string =>
  COLOR_THRESHOLDS.find(([min]) => percentage >= min)?.[1] ?? COLOR_DEFAULT

/** Show the quota of `id`'s project from now on (cached numbers first). */
const selectCredential = (id: string | null) => {
  if (useQuotaStore.getState().credentialId === id) return
  useQuotaStore.setState({ credentialId: id, quotas: readCachedQuotas(id), error: null })
}

const fetchQuotas = async () => {
  const id = useQuotaStore.getState().credentialId
  if (!id) {
    useQuotaStore.setState({ quotas: null })
    return
  }
  useQuotaStore.setState({ loading: true, error: null })
  try {
    const response = await quotasApi.getForCredential(id)
    if (useQuotaStore.getState().credentialId !== id) return // switched meanwhile
    useQuotaStore.setState({ quotas: response.data })
    writeCachedQuotas(id, response.data)
  } catch (err) {
    // Keep the cached numbers visible — a transient error shouldn't blank
    // out the tile.
    useQuotaStore.setState({ error: 'Failed to fetch quotas' })
    console.error('Quota fetch error:', err)
  } finally {
    useQuotaStore.setState({ loading: false })
  }
}

export interface QuotaRow {
  icon: LucideIcon
  label: string
  used: number
  /** null: unlimited */
  limit: number | null
  percentage: number
  unit: string
}

function quotaRow(
  icon: QuotaRow['icon'],
  label: string,
  item: { used: number; limit: number },
  unit = '',
  scale = 1,
): QuotaRow {
  return {
    icon,
    label,
    used: Math.round(item.used / scale),
    limit: item.limit < 0 ? null : Math.round(item.limit / scale),
    percentage: getPercentage(item.used, item.limit),
    unit,
  }
}

// ----------------------------------------------------------------
// USE QUOTAS HOOK
// ----------------------------------------------------------------
export const useQuotas = () => {
  const { t } = useTranslation()
  const { credentialId, quotas, loading, error } = useQuotaStore()

  const formattedQuotas = useMemo<QuotaRow[]>(() => {
    if (!quotas) return []
    const { compute, storage, network } = quotas
    return [
      quotaRow(Box, t('workspace.quotas.instances'), compute.instances),
      quotaRow(Cpu, t('workspace.quotas.vcpus'), compute.vcpus),
      quotaRow(Layers, t('workspace.quotas.ram'), compute.ram, 'GB', MB_PER_GB),
      quotaRow(HardDrive, t('workspace.quotas.volumes'), storage.volumes),
      quotaRow(HardDrive, t('workspace.quotas.storage'), storage.gigabytes, 'GB'),
      quotaRow(Network, t('workspace.quotas.floatingIps'), network.floating_ips),
    ]
  }, [quotas, t])

  return {
    credentialId,
    quotas,
    loading,
    error,
    formattedQuotas,
    hasCachedQuotas: quotas !== null,
    selectCredential,
    fetchQuotas,
    getColorClass,
  }
}
