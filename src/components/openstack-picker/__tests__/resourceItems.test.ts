import { describe, it, expect } from 'vitest'
import {
  adaptResource,
  osTypeLabel,
  selectedKeysOf,
  valueOf,
  filterAndSort,
  formatRam,
  formatSize,
  type ResourceItem,
} from '../resourceItems'

const t = (key: string) => key

describe('formatters', () => {
  it('formats RAM in MB or GB', () => {
    expect(formatRam(512)).toBe('512 MB')
    expect(formatRam(2048)).toBe('2 GB')
    expect(formatRam(1536)).toBe('1.5 GB')
    expect(formatRam(0)).toBe('0 MB')
  })

  it('formats image sizes', () => {
    expect(formatSize(5 * 1024 * 1024)).toBe('5 MB')
    expect(formatSize(2 * 1024 * 1024 * 1024)).toBe('2.0 GB')
    expect(formatSize(null)).toBe('')
  })
})

describe('adaptResource', () => {
  it('describes flavors with their specs', () => {
    const item = adaptResource('flavor', { id: 'f', name: 'm1', vcpus: 2, ram: 2048, disk: 20, is_public: true }, t)
    expect(item).toMatchObject({ id: 'f', name: 'm1', secondary: '2 vCPU · 2 GB RAM · 20 GB Disk', tertiary: '' })
  })

  it('marks private flavors', () => {
    expect(adaptResource('flavor', { id: 'f', name: 'm1', is_public: false }, t).tertiary).toBe('openstackPicker.network.private')
  })

  it('uses the name as id for keypairs and availability zones', () => {
    expect(adaptResource('keypair', { name: 'key', fingerprint: 'a'.repeat(40) }, t)).toMatchObject({
      id: 'key',
      secondary: 'a'.repeat(16) + '…',
      tertiary: 'ssh',
    })
    expect(adaptResource('availability_zone', { name: 'nova', state: 'available' }, t).id).toBe('nova')
  })

  it('describes networks with shared/external tags', () => {
    const item = adaptResource('network', { id: 'n', name: 'net', shared: true, external: true }, t)
    expect(item.tertiary).toBe('openstackPicker.network.shared · openstackPicker.network.external')
  })

  it('describes subnets and volumes', () => {
    expect(adaptResource('subnet', { id: 's', name: 'sn', cidr: '10.0.0.0/24', ip_version: 4, gateway_ip: '10.0.0.1' }, t)).toMatchObject({
      secondary: '10.0.0.0/24  IPv4',
      tertiary: 'openstackPicker.network.gatewayPrefix 10.0.0.1',
    })
    expect(adaptResource('volume', { id: 'v', size: 10, volume_type: 'ssd', bootable: true, status: 'available' }, t)).toMatchObject({
      name: 'openstackPicker.unnamed',
      secondary: '10 GB · ssd',
      tertiary: 'bootable · available',
    })
  })
})

describe('osTypeLabel', () => {
  it('returns human-readable labels', () => {
    expect(osTypeLabel('security_group')).toBe('Security Group')
    expect(osTypeLabel('floating_ip_pool')).toBe('Floating-IP Pool')
  })
})

describe('selectedKeysOf', () => {
  it('handles single values, including coerced numbers and null-ish strings', () => {
    expect([...selectedKeysOf('a', false)]).toEqual(['a'])
    expect([...selectedKeysOf(2 as any, false)]).toEqual(['2'])
    expect(selectedKeysOf('null', false).size).toBe(0)
    expect(selectedKeysOf(undefined, false).size).toBe(0)
    expect(selectedKeysOf(null, false).size).toBe(0)
  })

  it('handles arrays and comma-separated strings in multi mode', () => {
    expect([...selectedKeysOf(['a', 'b', ''], true)]).toEqual(['a', 'b'])
    expect([...selectedKeysOf('a, b ,c', true)]).toEqual(['a', 'b', 'c'])
    expect(selectedKeysOf('', true).size).toBe(0)
  })
})

describe('valueOf / filterAndSort', () => {
  const items: ResourceItem[] = [
    { id: 'id-1', name: 'alpha', secondary: 'small', raw: {} },
    { id: 'id-2', name: 'beta', secondary: 'large', raw: {} },
    { id: 'id-3', name: 'gamma', raw: {} },
  ]

  it('stores the id or the name depending on the mode', () => {
    expect(valueOf(items[0]!, 'id')).toBe('id-1')
    expect(valueOf(items[0]!, 'name')).toBe('alpha')
  })

  it('filters by name, id and secondary text, case-insensitively', () => {
    expect(filterAndSort(items, 'BET', new Set(), 'name').map((i) => i.name)).toEqual(['beta'])
    expect(filterAndSort(items, 'id-3', new Set(), 'name').map((i) => i.name)).toEqual(['gamma'])
    expect(filterAndSort(items, 'large', new Set(), 'name').map((i) => i.name)).toEqual(['beta'])
  })

  it('pulls selected entries to the top, keeping the relative order otherwise', () => {
    expect(filterAndSort(items, '', new Set(['gamma']), 'name').map((i) => i.name)).toEqual(['gamma', 'alpha', 'beta'])
  })
})
