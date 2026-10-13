import { ref, computed } from 'vue'
import axios from 'axios'
import { Cpu, HardDrive, Network, Box, Layers } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { quotasApi } from '@/api/quotas.api'
import type { QuotaOverview } from '@/types/quota'

// ----------------------------------------------------------------
// MODULE-SCOPED STATE (shared across all consumers)
// ----------------------------------------------------------------
// Why module-scoped: the dashboard mounts/unmounts whenever the user
// navigates, but we want the quota tile to keep showing the last known
// numbers while the next fetch is in flight instead of flashing the
// loading skeleton again. Lifting state above the composable factory is
// the cheapest way to share it; sessionStorage extends that across
// reloads inside the same browser session.
const STORAGE_KEY = 'openstack.quotas.v1'

function readCachedQuotas(): QuotaOverview | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as QuotaOverview
  } catch {
    return null
  }
}

function writeCachedQuotas(value: QuotaOverview | null) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // sessionStorage may be unavailable (private mode, quota) — degrade silently
  }
}

const quotas = ref<QuotaOverview | null>(readCachedQuotas())
const loading = ref(false)
const error = ref<string | null>(null)
const needsCredentials = ref(false)

// ----------------------------------------------------------------
// USE QUOTAS COMPOSABLE
// ----------------------------------------------------------------
export const useQuotas = () => {
  const { t } = useI18n()
  const getPercentage = (used: number, limit: number): number => {
    if (limit === 0) return 0
    return Math.round((used / limit) * 100)
  }

  const getColorClass = (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 75) return 'bg-orange-500'
    if (percentage >= 50) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const formattedQuotas = computed(() => {
    if (!quotas.value) return []

    const { compute, storage, network } = quotas.value

    return [
      {
        icon: Box,
        label: t('workspace.quotas.instances'),
        used: compute.instances.used,
        limit: compute.instances.limit,
        percentage: getPercentage(compute.instances.used, compute.instances.limit),
        unit: ''
      },
      {
        icon: Cpu,
        label: t('workspace.quotas.vcpus'),
        used: compute.vcpus.used,
        limit: compute.vcpus.limit,
        percentage: getPercentage(compute.vcpus.used, compute.vcpus.limit),
        unit: ''
      },
      {
        icon: Layers,
        label: t('workspace.quotas.ram'),
        used: Math.round(compute.ram.used / 1024),
        limit: Math.round(compute.ram.limit / 1024),
        percentage: getPercentage(compute.ram.used, compute.ram.limit),
        unit: 'GB'
      },
      {
        icon: HardDrive,
        label: t('workspace.quotas.volumes'),
        used: storage.volumes.used,
        limit: storage.volumes.limit,
        percentage: getPercentage(storage.volumes.used, storage.volumes.limit),
        unit: ''
      },
      {
        icon: HardDrive,
        label: t('workspace.quotas.storage'),
        used: storage.gigabytes.used,
        limit: storage.gigabytes.limit,
        percentage: getPercentage(storage.gigabytes.used, storage.gigabytes.limit),
        unit: 'GB'
      },
      {
        icon: Network,
        label: t('workspace.quotas.floatingIps'),
        used: network.floating_ips.used,
        limit: network.floating_ips.limit,
        percentage: getPercentage(network.floating_ips.used, network.floating_ips.limit),
        unit: ''
      }
    ]
  })

  const hasCachedQuotas = computed(() => quotas.value !== null)

  const fetchQuotas = async () => {
    loading.value = true
    error.value = null
    needsCredentials.value = false

    try {
      const response = await quotasApi.getOverview()
      quotas.value = response.data
      writeCachedQuotas(response.data)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 412) {
        needsCredentials.value = true
        // Drop the cache: credentials are gone, the old numbers don't apply
        quotas.value = null
        writeCachedQuotas(null)
      } else {
        error.value = 'Failed to fetch quotas'
        console.error('Quota fetch error:', err)
        // Keep the existing cached numbers visible — a transient error
        // shouldn't blank out the tile.
      }
    } finally {
      loading.value = false
    }
  }

  return {
    quotas,
    loading,
    error,
    needsCredentials,
    formattedQuotas,
    hasCachedQuotas,
    fetchQuotas,
    getColorClass
  }
}
