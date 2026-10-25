import { describe, it, expect } from 'vitest'
import { Box } from 'lucide-react'
import { getQuotaWarnings, QUOTA_WARNING_THRESHOLD } from '../quotaWarnings'
import type { QuotaRow } from '@/composables/useQuotas'

function row(percentage: number, label = 'vcpus'): QuotaRow {
  return { icon: Box, label, used: percentage, limit: 100, percentage, unit: '' }
}

describe('getQuotaWarnings', () => {
  it('returns empty array when no rows exceed threshold', () => {
    expect(getQuotaWarnings([row(50), row(70)])).toEqual([])
  })

  it('returns rows at exactly the threshold', () => {
    const r = row(QUOTA_WARNING_THRESHOLD)
    expect(getQuotaWarnings([r])).toEqual([r])
  })

  it('returns rows above the threshold', () => {
    const high = row(95)
    const low = row(40)
    expect(getQuotaWarnings([high, low])).toEqual([high])
  })

  it('skips unlimited quotas (percentage === 0 from limit -1)', () => {
    const unlimited = { icon: Box, label: 'storage', used: 20, limit: null, percentage: 0, unit: 'GB' }
    expect(getQuotaWarnings([unlimited])).toEqual([])
  })

  it('returns multiple warnings when several quotas are high', () => {
    const a = row(80, 'vcpus')
    const b = row(90, 'ram')
    const c = row(60, 'instances')
    expect(getQuotaWarnings([a, b, c])).toEqual([a, b])
  })

  it('returns empty array for empty input', () => {
    expect(getQuotaWarnings([])).toEqual([])
  })
})
