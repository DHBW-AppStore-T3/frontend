import type { OsResourceType } from '@/api/openstack-resources.api'

/** Mode of the stored value: the resource's UUID or its name. */
export type PickerMode = 'id' | 'name'

export interface ResourceItem {
  id: string
  name: string
  /** Rough spec line (e.g. "2 vCPU · 4 GB RAM"). */
  secondary?: string
  /** Small uppercase tag (e.g. "shared"). */
  tertiary?: string
  raw: unknown
}

type Translate = (key: string) => string
type Raw = Record<string, any>

const BYTES_PER_MB = 1024 * 1024
const MB_PER_GB = 1024
const FINGERPRINT_PREVIEW = 16

export function formatRam(mb: number | undefined | null): string {
  if (!mb) return '0 MB'
  if (mb < MB_PER_GB) return `${mb} MB`
  return `${(mb / MB_PER_GB).toFixed(mb % MB_PER_GB === 0 ? 0 : 1)} GB`
}

export function formatSize(bytes: number | undefined | null): string {
  if (!bytes) return ''
  const mb = bytes / BYTES_PER_MB
  if (mb < MB_PER_GB) return `${mb.toFixed(0)} MB`
  return `${(mb / MB_PER_GB).toFixed(1)} GB`
}

const LABELS: Record<OsResourceType, string> = {
  network: 'Network',
  subnet: 'Subnet',
  flavor: 'Flavor',
  image: 'Image',
  keypair: 'Keypair',
  security_group: 'Security Group',
  floating_ip_pool: 'Floating-IP Pool',
  volume: 'Volume',
  router: 'Router',
  availability_zone: 'Availability Zone',
}

export const osTypeLabel = (osType: OsResourceType): string => LABELS[osType]

/** Per-type display adaptation of a raw OpenStack resource. */
export function adaptResource(osType: OsResourceType, raw: Raw, t: Translate): ResourceItem {
  const base = { id: raw.id ?? '', name: raw.name ?? '', raw }
  switch (osType) {
    case 'flavor':
      return {
        ...base,
        secondary: `${raw.vcpus ?? 0} vCPU · ${formatRam(raw.ram)} RAM · ${raw.disk ?? 0} GB Disk`,
        tertiary: raw.is_public ? '' : t('openstackPicker.network.private'),
      }
    case 'image':
      return {
        ...base,
        secondary: raw.disk_format ? `${raw.disk_format} · ${formatSize(raw.size)}` : formatSize(raw.size),
        tertiary: raw.status === 'active' ? '' : raw.status,
      }
    case 'network':
      return {
        ...base,
        secondary: raw.description || '',
        tertiary: [
          raw.shared ? t('openstackPicker.network.shared') : '',
          raw.external ? t('openstackPicker.network.external') : '',
        ]
          .filter(Boolean)
          .join(' · '),
      }
    case 'subnet':
      return {
        ...base,
        secondary: `${raw.cidr || '?'}  IPv${raw.ip_version ?? 4}`,
        tertiary: raw.gateway_ip ? `${t('openstackPicker.network.gatewayPrefix')} ${raw.gateway_ip}` : '',
      }
    case 'keypair':
      return {
        id: raw.name ?? '',
        name: raw.name ?? '',
        raw,
        secondary: raw.fingerprint ? raw.fingerprint.slice(0, FINGERPRINT_PREVIEW) + '…' : '',
        tertiary: raw.type || 'ssh',
      }
    case 'security_group':
    case 'floating_ip_pool':
      return { ...base, secondary: raw.description || '' }
    case 'volume':
      return {
        ...base,
        name: raw.name || t('openstackPicker.unnamed'),
        secondary: `${raw.size ?? 0} GB · ${raw.volume_type || ''}`,
        tertiary: [raw.bootable ? 'bootable' : '', raw.status].filter(Boolean).join(' · '),
      }
    case 'router':
      return {
        ...base,
        secondary: raw.status || '',
        tertiary: raw.external_gateway_info ? t('openstackPicker.network.externalGateway') : '',
      }
    case 'availability_zone':
      return { id: raw.name ?? '', name: raw.name ?? '', raw, secondary: raw.state || '' }
  }
}

/** The value a picked item contributes to the model, depending on the mode. */
export const valueOf = (item: ResourceItem, mode: PickerMode): string => (mode === 'id' ? item.id : item.name)

// HCL defaults can arrive as number/boolean (``default = 2``); coerce to string.
// ``null``/``undefined`` and their literal string forms are treated as empty.
function toKey(x: unknown): string {
  if (x === null || x === undefined) return ''
  const s = String(x)
  return s === 'null' || s === 'undefined' ? '' : s
}

/** Currently selected values of the model (array, CSV string or single value). */
export function selectedKeysOf(value: string | string[] | null | undefined, multi: boolean): Set<string> {
  if (multi) {
    if (Array.isArray(value)) return new Set(value.map(toKey).filter(Boolean))
    if (typeof value === 'string' && value.trim()) {
      return new Set(
        value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      )
    }
    return new Set()
  }
  const key = toKey(value)
  return new Set(key ? [key] : [])
}

/**
 * Search filter (name, id, secondary text) with selected items pulled to the
 * top so a set default is visible in a long list. The sort is stable.
 */
export function filterAndSort(
  items: ResourceItem[],
  query: string,
  selected: Set<string>,
  mode: PickerMode,
): ResourceItem[] {
  const q = query.trim().toLowerCase()
  const visible = q
    ? items.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          it.id.toLowerCase().includes(q) ||
          (it.secondary || '').toLowerCase().includes(q),
      )
    : items
  const rank = (it: ResourceItem) => (selected.has(valueOf(it, mode)) ? 0 : 1)
  return [...visible].sort((a, b) => rank(a) - rank(b))
}
