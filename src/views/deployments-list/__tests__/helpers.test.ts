import { describe, it, expect } from 'vitest'
import { sortNewestFirst, STATUS_GROUPS, countByGroup, filterByGroup, statusPillClass } from '../helpers'

const dep = (id: string, status: string, created_at: string | null) => ({ deploymentId: id, status, created_at }) as any

describe('sortNewestFirst', () => {
  it('orders by created_at descending without mutating the input', () => {
    const input = [dep('a', 's', '2026-01-01'), dep('c', 's', '2026-12-01'), dep('b', 's', '2026-06-01')]
    const copy = [...input]
    expect(sortNewestFirst(input).map((d) => d.deploymentId)).toEqual(['c', 'b', 'a'])
    expect(input).toEqual(copy)
  })

  it('sorts items without a timestamp to the end', () => {
    const sorted = sortNewestFirst([dep('x', 's', null), dep('y', 's', '2026-06-01')])
    expect(sorted.map((d) => d.deploymentId)).toEqual(['y', 'x'])
  })
})

describe('status groups', () => {
  const items = [dep('1', 'success', null), dep('2', 'running', null), dep('3', 'failed', null), dep('4', 'paused', null)]

  it('keeps the three lifecycle groups', () => {
    expect(Object.keys(STATUS_GROUPS)).toEqual(['active', 'building', 'stopped'])
  })

  it('a redeploy in flight is building; a failed one is still running, so active', () => {
    expect(filterByGroup([dep('r', 'redeploying', null)], 'building')).toHaveLength(1)
    expect(filterByGroup([dep('f', 'redeploy_failed', null)], 'active')).toHaveLength(1)
    expect(filterByGroup([dep('f', 'redeploy_failed', null)], 'stopped')).toHaveLength(0)
  })

  it('colours the redeploy states', () => {
    expect(statusPillClass('redeploying')).toContain('blue')
    expect(statusPillClass('redeploy_failed')).toContain('amber')
  })

  it('counts per group and for "all"', () => {
    expect(countByGroup(items)).toEqual([
      { key: 'active', count: 1 },
      { key: 'building', count: 1 },
      { key: 'stopped', count: 2 },
      { key: 'all', count: 4 },
    ])
  })

  it('filters by group, or returns everything for "all"', () => {
    expect(filterByGroup(items, 'stopped').map((d) => d.deploymentId)).toEqual(['3', '4'])
    expect(filterByGroup(items, 'all')).toHaveLength(4)
    expect(filterByGroup(items, 'unknown')).toEqual([])
  })
})

describe('statusPillClass', () => {
  it('maps known statuses and falls back for unknown ones', () => {
    expect(statusPillClass('success')).toContain('bg-successTint')
    expect(statusPillClass('destroying')).toContain('bg-orange-100')
    expect(statusPillClass('weird')).toContain('bg-surfaceMuted')
  })
})
