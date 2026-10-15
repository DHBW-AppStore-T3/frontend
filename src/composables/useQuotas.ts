import { ref, computed } from 'vue'
import { Cpu, HardDrive, Network, Box, Layers } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
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

function readCachedQuotas(credentialId: string | null): QuotaOverview | null {
  if (!credentialId) return null
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + credentialId)
    if (!raw) return null
    return JSON.parse(raw) as QuotaOverview
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

const credentialId = ref<string | null>(null)
const quotas = ref<QuotaOverview | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

// ----------------------------------------------------------------
// USE QUOTAS COMPOSABLE
// ----------------------------------------------------------------
export const useQuotas = () => {
  const { t } = useI18n()

  // An unlimited quota (-1) never fills up.
  const getPercentage = (used: number, limit: number): number => {
    if (limit <= 0) return 0
    return Math.round((used / limit) * 100)
  }

  const getColorClass = (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 75) return 'bg-orange-500'
    if (percentage >= 50) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const item = (icon: unknown, label: string, used: number, limit: number, unit = '', scale = 1) => ({
    icon,
    label,
    used: Math.round(used / scale),
    // null: unlimited
    limit: limit < 0 ? null : Math.round(limit / scale),
    percentage: getPercentage(used, limit),
    unit,
  })

  const formattedQuotas = computed(() => {
    if (!quotas.value) return []
    const { compute, storage, network } = quotas.value
    return [
      item(Box, t('workspace.quotas.instances'), compute.instances.used, compute.instances.limit),
      item(Cpu, t('workspace.quotas.vcpus'), compute.vcpus.used, compute.vcpus.limit),
      item(Layers, t('workspace.quotas.ram'), compute.ram.used, compute.ram.limit, 'GB', 1024),
      item(HardDrive, t('workspace.quotas.volumes'), storage.volumes.used, storage.volumes.limit),
      item(HardDrive, t('workspace.quotas.storage'), storage.gigabytes.used, storage.gigabytes.limit, 'GB'),
      item(Network, t('workspace.quotas.floatingIps'), network.floating_ips.used, network.floating_ips.limit),
    ]
  })

  const hasCachedQuotas = computed(() => quotas.value !== null)

  /** Show the quota of ``id``'s project from now on (cached numbers first). */
  const selectCredential = (id: string | null) => {
    if (credentialId.value === id) return
    credentialId.value = id
    quotas.value = readCachedQuotas(id)
    error.value = null
  }

  const fetchQuotas = async () => {
    const id = credentialId.value
    if (!id) {
      quotas.value = null
      return
    }
    loading.value = true
    error.value = null
    try {
      const response = await quotasApi.getForCredential(id)
      if (credentialId.value !== id) return // switched meanwhile
      quotas.value = response.data
      writeCachedQuotas(id, response.data)
    } catch (err) {
      error.value = 'Failed to fetch quotas'
      console.error('Quota fetch error:', err)
      // Keep the cached numbers visible — a transient error shouldn't
      // blank out the tile.
    } finally {
      loading.value = false
    }
  }

  return {
    credentialId,
    quotas,
    loading,
    error,
    formattedQuotas,
    hasCachedQuotas,
    selectCredential,
    fetchQuotas,
    getColorClass,
  }
}
