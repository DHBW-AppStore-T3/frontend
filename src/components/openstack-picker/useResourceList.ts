import { useEffect, useRef, useState } from 'react'
import { openstackResourcesApi, type OsResourceType } from '@/api/openstack-resources.api'
import {
  prime as primeDisplayCache,
  invalidate as invalidateDisplayCache,
  ensureLoaded,
} from '@/composables/useOpenStackResourceCache'

export type AzService = 'compute' | 'network' | 'volume'
export type ListError = { reason: 'credentials_missing' | 'unavailable'; message: string }

interface Options {
  osType: OsResourceType
  /** Restricts subnets to one network. */
  filterNetworkId?: string | null
  azService?: AzService
  /** When false (free-text mode) nothing is loaded. */
  enabled: boolean
  /** Fallback texts for error messages. */
  fallbackMessages: { osError: string; loadFailed: string }
}

interface ListResult {
  key: string
  data: unknown[]
  error: ListError | null
}

function fetchByType(osType: OsResourceType, filterNetworkId?: string | null, azService?: AzService) {
  const api = openstackResourcesApi
  switch (osType) {
    case 'network':
      return api.listNetworks()
    case 'subnet':
      return api.listSubnets(filterNetworkId || undefined)
    case 'flavor':
      return api.listFlavors()
    case 'image':
      return api.listImages('active')
    case 'keypair':
      return api.listKeypairs()
    case 'security_group':
      return api.listSecurityGroups()
    case 'floating_ip_pool':
      return api.listFloatingIpPools()
    case 'volume':
      return api.listVolumes()
    case 'router':
      return api.listRouters()
    case 'availability_zone':
      return api.listAvailabilityZones(azService || 'compute')
  }
}

function toListError(err: any, fallbacks: Options['fallbackMessages']): ListError {
  const status = err?.response?.status
  const detail = err?.response?.data?.detail
  if (status === 412 && detail?.reason === 'openstack_credentials_missing') {
    return { reason: 'credentials_missing', message: '' }
  }
  if (status === 502 || detail?.reason === 'openstack_unavailable' || detail?.reason === 'openstack_list_failed') {
    return { reason: 'unavailable', message: detail?.message || err?.message || fallbacks.osError }
  }
  return { reason: 'unavailable', message: err?.message || fallbacks.loadFailed }
}

/**
 * Loads the resource list of one OpenStack type. A request is identified by
 * (type, filter, az service, refresh counter); loading is derived from "the
 * latest result is not for the current request yet".
 */
export function useResourceList({ osType, filterNetworkId, azService, enabled, fallbackMessages }: Options) {
  const [nonce, setNonce] = useState(0)
  const key = `${osType}|${filterNetworkId ?? ''}|${azService ?? ''}|${nonce}`
  const [result, setResult] = useState<ListResult>({ key: '', data: [], error: null })
  const fallbacks = useRef(fallbackMessages)
  useEffect(() => {
    fallbacks.current = fallbackMessages
  })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchByType(osType, filterNetworkId, azService)
        const data = (res.data || []) as unknown[]
        // Prime the shared display cache, but only for an unfiltered load: a
        // per-network subnet list must not pollute the global cache.
        if (!filterNetworkId) primeDisplayCache(osType, data as any)
        if (!cancelled) setResult({ key, data, error: null })
      } catch (err) {
        if (!cancelled) setResult({ key, data: [], error: toListError(err, fallbacks.current) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, key, osType, filterNetworkId, azService])

  // Feed the shared cache once so other components (summary view) can resolve names.
  useEffect(() => {
    if (!filterNetworkId) void ensureLoaded(osType)
  }, [osType, filterNetworkId])

  const isLoading = enabled && result.key !== key

  /** Re-fetches after dropping the backend's and the display cache's copies. */
  const refresh = async () => {
    try {
      await openstackResourcesApi.refresh(osType)
    } catch (err) {
      console.warn('[OsPicker] refresh failed:', err)
    }
    invalidateDisplayCache(osType)
    setNonce((n) => n + 1)
  }

  return {
    data: result.data,
    isLoading,
    error: isLoading ? null : result.error,
    refresh,
  }
}
