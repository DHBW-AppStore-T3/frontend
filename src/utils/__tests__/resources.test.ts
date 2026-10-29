import { describe, expect, it } from 'vitest'
import {
  cpuToMillicores,
  defaultSelection,
  formatCpu,
  formatMemory,
  memoryToMib,
  steps,
} from '../resources'

describe('resources', () => {
  it('converts the notation of appstore.yaml', () => {
    expect(cpuToMillicores('500m')).toBe(500)
    expect(cpuToMillicores('2')).toBe(2000)
    expect(cpuToMillicores('1.5')).toBe(1500)
    expect(memoryToMib('512Mi')).toBe(512)
    expect(memoryToMib('4Gi')).toBe(4096)
  })

  it('formats back to the shortest notation', () => {
    expect(formatCpu(2000)).toBe('2')
    expect(formatCpu(1500)).toBe('1500m')
    expect(formatMemory(4096)).toBe('4Gi')
    expect(formatMemory(1536)).toBe('1536Mi')
  })

  it('offers steps that include both ends', () => {
    expect(steps(1000, 2000, 500)).toEqual([1000, 1500, 2000])
    expect(steps(1000, 1200, 500)).toEqual([1000, 1200])
  })

  it('selects the defaults of every container', () => {
    const range = { default: '2', min: '1', max: '4' }
    expect(
      defaultSelection([{ container: 'win', cpu: range, memory: { default: '4Gi', min: '2Gi', max: '8Gi' } }]),
    ).toEqual({ win: { cpu: '2', memory: '4Gi' } })
    expect(defaultSelection([])).toEqual({})
  })
})
