import { describe, expect, it } from 'vitest'
import type { ResourceChoice } from '@/types'
import { formatMemoryGb, isDefaultSelection, totalResources } from '../resources'

const vm: ResourceChoice[] = [
  {
    container: 'vm',
    cpu: { default: '4', min: '2', max: '8' },
    memory: { default: '8Gi', min: '4Gi', max: '16Gi' },
  },
]

describe('resources for a VM', () => {
  it('shows memory in GB for people (the payload stays in Gi)', () => {
    expect(formatMemoryGb(8192)).toBe('8')
    expect(formatMemoryGb(12288)).toBe('12')
    expect(formatMemoryGb(1536)).toBe('1.5')
  })

  it('knows when the selection is the recommendation', () => {
    expect(isDefaultSelection(vm, { vm: { cpu: '4', memory: '8Gi' } })).toBe(true)
    expect(isDefaultSelection(vm, { vm: { cpu: '6', memory: '8Gi' } })).toBe(false)
    expect(isDefaultSelection(vm, { vm: { cpu: '4', memory: '12Gi' } })).toBe(false)
  })

  it('treats a missing selection as the recommendation', () => {
    expect(isDefaultSelection(vm, {})).toBe(true)
  })

  it('compares quantities, not spellings', () => {
    expect(isDefaultSelection(vm, { vm: { cpu: '4000m', memory: '8192Mi' } })).toBe(true)
  })

  it('adds up what every container gets', () => {
    expect(totalResources(vm, { vm: { cpu: '6', memory: '12Gi' } })).toEqual({ cpuMillicores: 6000, memoryMib: 12288 })
    expect(totalResources(vm, {})).toEqual({ cpuMillicores: 4000, memoryMib: 8192 })
  })
})
