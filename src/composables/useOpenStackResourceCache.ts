/**
 * Display cache for OpenStack resources.
 *
 * Background: depending on ``osMode`` the picker stores either the UUID
 * or the name of a resource. In the trigger button and the summary view
 * the user should ALWAYS see the friendly name — even when the stored
 * value is a UUID.
 *
 * Solution: a module-global cache, filled by every picker that loads.
 * - Multiple pickers for the same ``osType`` share the cache (no
 *   re-fetch).
 * - The summary view can read the cache synchronously via
 *   ``getDisplayName(osType, mode, value)``, OR trigger
 *   ``ensureLoaded(osType)`` once on mount.
 * - Cache TTL: matched to the backend cache (60s) — after that it is
 *   reloaded on the next picker open.
 *
 * CREDENTIAL: every list belongs to one of the caller's OpenStack
 * credentials (the one the deployment will be created with). The wizard
 * sets it with ``setCredential``; switching to another credential empties
 * the cache, because another project has other resources.
 *
 * REACTIVITY: the cache itself is a plain ``Map``, but a version counter
 * (``cacheVersion``) is incremented on every ``prime``/``invalidate`` and
 * subscribers are notified. Components call ``useOpenStackCacheVersion()``
 * and read the cache via ``getDisplayName`` — so they re-render as soon as
 * another component updates the cache.
 */
import { useSyncExternalStore } from 'react'
import {
  openstackResourcesApi,
  type OsResourceType,
  type OsResourceBase,
} from '@/api/openstack-resources.api'

interface CachedItem {
  id: string
  name: string
  // Secondary display info if provided by the picker (e.g. flavor specs).
  // Optional — the summary view only uses ``name``.
  secondary?: string
  raw: any
}

interface CacheEntry {
  items: CachedItem[]
  loadedAt: number
  // Pending promise — prevents a thundering herd when several pickers request
  // the same list at once.
  loading?: Promise<void>
}

// In-memory cache, process-local per browser tab. Cleared on reload.
const cache = new Map<OsResourceType, CacheEntry>()

// Version counter. Every cache mutation bumps it and notifies subscribers;
// React consumers observe it through ``useOpenStackCacheVersion``.
let cacheVersion = 0
const listeners = new Set<() => void>()

function bumpVersion(): void {
  cacheVersion += 1
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Subscribes the calling component to cache changes. Call it in any component
 * that renders values from ``getDisplayName`` so it re-renders on updates.
 */
export function useOpenStackCacheVersion(): number {
  return useSyncExternalStore(subscribe, () => cacheVersion)
}

const TTL_MS = 60_000

// The credential the lists are read with (null: none chosen yet).
let credentialId: string | null = null

/**
 * Read every list with `id` from now on. A different credential than before
 * empties the cache (another project, other resources).
 */
export function setCredential(id: string | null): void {
  if (credentialId === id) return
  credentialId = id
  invalidateAll()
}

/** The credential lists are read with, or null when none is chosen. */
export function currentCredential(): string | null {
  return credentialId
}

/**
 * Returns a cache entry no older than the TTL, or ``null`` if missing/expired.
 */
function getFresh(osType: OsResourceType): CacheEntry | null {
  const entry = cache.get(osType)
  if (!entry) return null
  if (Date.now() - entry.loadedAt > TTL_MS) return null
  return entry
}

/**
 * Ensures the list for ``osType`` is loaded (or loading). Deduplicates parallel
 * calls. Filtered lists (e.g. ``network_id`` for subnets) are not cached here.
 * Never throws — errors are swallowed and the cache stays empty; pickers show
 * their own error UI.
 */
export async function ensureLoaded(osType: OsResourceType): Promise<void> {
  const fresh = getFresh(osType)
  if (fresh && !fresh.loading) return
  if (fresh?.loading) {
    await fresh.loading
    return
  }

  const requestedFor = credentialId
  const loading = (async () => {
    try {
      const res = await fetchList(osType)
      // Another credential was chosen while this list was on its way.
      if (credentialId !== requestedFor) return
      cache.set(osType, {
        items: res.map(toCachedItem),
        loadedAt: Date.now(),
      })
      bumpVersion()
    } catch {
      // Deliberately no throw — cache stays empty, picker shows its own error UI.
    }
  })()

  // Set the pending marker so parallel calls wait instead of re-fetching. Don't
  // bump ``cacheVersion``: the visible cache view hasn't changed yet.
  cache.set(osType, {
    items: cache.get(osType)?.items || [],
    loadedAt: cache.get(osType)?.loadedAt || 0,
    loading,
  })

  await loading
  // Remove ``loading`` from the entry again.
  const final = cache.get(osType)
  if (final) {
    delete final.loading
  }
}

/**
 * Writes an already-fetched list into the cache. Called by the picker when it
 * already has items in hand (e.g. loaded with a filter, or just refreshed) to
 * prevent a double-fetch by other pickers or the summary.
 */
export function prime(osType: OsResourceType, items: ReadonlyArray<OsResourceBase & Record<string, any>>): void {
  cache.set(osType, {
    items: items.map(toCachedItem),
    loadedAt: Date.now(),
  })
  bumpVersion()
}

/**
 * Cache-bust for a single ``osType`` (refresh button).
 */
export function invalidate(osType: OsResourceType): void {
  if (cache.delete(osType)) {
    bumpVersion()
  }
}

/**
 * Full cache invalidation, called on logout so the previous session's cache
 * doesn't leak to the next user (who has their own OpenStack credentials).
 */
export function invalidateAll(): void {
  if (cache.size === 0) return
  cache.clear()
  bumpVersion()
}

/**
 * Synchronous lookup. Returns the display name for a raw value (UUID or name),
 * depending on the variable's mode.
 *
 * - mode='id', value=UUID → lookup via ``items.id``, returns ``name``
 * - mode='name', value=name → confirms existence, returns name
 * - cache miss / unknown value → returns the raw value with ``known: false``
 * - cross-mode fallback: if the primary mode lookup misses, the other mode is
 *   tried (e.g. the variable stores UUIDs but the HCL default is a name). On a
 *   hit there, returns ``known: true`` with ``modeMismatch: true`` so the caller
 *   can render a subtle hint.
 *
 * Returns ``null`` when ``value`` is empty.
 *
 * Components rendering this value must also call ``useOpenStackCacheVersion()``
 * so they re-render when the cache changes.
 */
export function getDisplayName(
  osType: OsResourceType,
  mode: 'id' | 'name',
  value: string | null | undefined,
): { name: string; known: boolean; modeMismatch?: boolean } | null {
  if (!value) return null
  const entry = cache.get(osType)
  if (!entry) {
    return { name: value, known: false }
  }
  const found = mode === 'id'
    ? entry.items.find((it) => it.id === value)
    : entry.items.find((it) => it.name === value)
  if (found) {
    return { name: found.name, known: true }
  }
  // Cross-mode fallback: the primary lookup missed, so try the other mode
  // (typically the variable stores UUIDs but the default is a name, or vice
  // versa). On a match, return the name with ``modeMismatch`` so the UI can
  // surface the mismatch without blocking the value.
  const fallback = mode === 'id'
    ? entry.items.find((it) => it.name === value)
    : entry.items.find((it) => it.id === value)
  if (fallback) {
    return { name: fallback.name, known: true, modeMismatch: true }
  }
  return { name: value, known: false }
}

// ----------------------------------------------------------------
// Internal: per-type Fetcher
// ----------------------------------------------------------------
type ListFetcher = (id: string) => Promise<{ data: any[] }>

const LIST_FETCHERS: Record<OsResourceType, ListFetcher> = {
  network: (id) => openstackResourcesApi.listNetworks(id),
  subnet: (id) => openstackResourcesApi.listSubnets(id),
  flavor: (id) => openstackResourcesApi.listFlavors(id),
  image: (id) => openstackResourcesApi.listImages(id, 'active'),
  keypair: (id) => openstackResourcesApi.listKeypairs(id),
  security_group: (id) => openstackResourcesApi.listSecurityGroups(id),
  floating_ip_pool: (id) => openstackResourcesApi.listFloatingIpPools(id),
  volume: (id) => openstackResourcesApi.listVolumes(id),
  router: (id) => openstackResourcesApi.listRouters(id),
  availability_zone: (id) => openstackResourcesApi.listAvailabilityZones(id, 'compute'),
}

async function fetchList(osType: OsResourceType): Promise<any[]> {
  if (!credentialId) return []
  return (await LIST_FETCHERS[osType](credentialId)).data
}

function toCachedItem(raw: any): CachedItem {
  return {
    id: raw.id ?? raw.name ?? '',
    name: raw.name ?? '',
    raw,
  }
}
