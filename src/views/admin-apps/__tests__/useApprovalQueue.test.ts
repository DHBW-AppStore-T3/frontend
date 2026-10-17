import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('@/api/app.api', () => ({
  appApi: {
    list: vi.fn(),
    listVersionApprovals: vi.fn(),
    admin: {
      listPendingApprovals: vi.fn(),
      approveVersion: vi.fn(),
      rejectVersion: vi.fn(),
      revokeVersion: vi.fn(),
    },
  },
}))

import { appApi } from '@/api/app.api'
import { useApprovalQueue } from '../useApprovalQueue'

const apps = [
  { appId: 'a1', name: 'One', is_private: false },
  { appId: 'a2', name: 'Two', is_private: false },
]
const approvals = [
  { approvalId: 'v1', version_tag: '1.0', status: 'pending', created_at: '2026-01-01' },
  { approvalId: 'v2', version_tag: '0.9', status: 'approved', created_at: '2025-12-01' },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(appApi.list).mockResolvedValue({ data: apps } as any)
  vi.mocked(appApi.admin.listPendingApprovals).mockResolvedValue({
    data: [{ appId: 'a1' }, { appId: 'a1' }, { appId: 'a2' }],
  } as any)
  vi.mocked(appApi.listVersionApprovals).mockResolvedValue({ data: approvals.map((a) => ({ ...a })) } as any)
})

const setup = async () => {
  const hook = renderHook(() => useApprovalQueue())
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false))
  return hook
}

describe('useApprovalQueue', () => {
  it('derives pending and submission counts from the pending queue', async () => {
    const { result } = await setup()
    expect(result.current.pendingCount).toEqual({ a1: 2, a2: 1 })
    expect(result.current.submissionCount).toEqual({ a1: 2, a2: 1 })
  })

  it('reports a failed load through onError and ends loading', async () => {
    vi.mocked(appApi.list).mockRejectedValue(new Error('x'))
    const onError = vi.fn()
    const { result } = renderHook(() => useApprovalQueue({ onLoadError: onError }))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('loads approvals lazily once and recounts from the full list', async () => {
    const { result } = await setup()

    await act(() => result.current.loadApprovals('a1'))
    await act(() => result.current.loadApprovals('a1'))

    expect(appApi.listVersionApprovals).toHaveBeenCalledTimes(1)
    expect(result.current.approvals.a1).toHaveLength(2)
    expect(result.current.pendingCount.a1).toBe(1)
    expect(result.current.submissionCount.a1).toBe(2)
  })

  it('falls back to an empty list when loading approvals fails', async () => {
    vi.mocked(appApi.listVersionApprovals).mockRejectedValue(new Error('x'))
    const { result } = await setup()
    await act(() => result.current.loadApprovals('a1'))
    expect(result.current.approvals.a1).toEqual([])
  })

  it('approve marks the version approved and decrements the pending count', async () => {
    vi.mocked(appApi.admin.approveVersion).mockResolvedValue({} as any)
    const { result } = await setup()
    await act(() => result.current.loadApprovals('a1'))

    let ok = false
    await act(async () => {
      ok = await result.current.approve('a1', '1.0')
    })

    expect(ok).toBe(true)
    expect(appApi.admin.approveVersion).toHaveBeenCalledWith('a1', '1.0')
    expect(result.current.approvals.a1!.find((a) => a.version_tag === '1.0')!.status).toBe('approved')
    expect(result.current.pendingCount.a1).toBe(0)
    expect(result.current.actingOn).toBeNull()
  })

  it('approve reports failure without touching state', async () => {
    vi.mocked(appApi.admin.approveVersion).mockRejectedValue(new Error('x'))
    const { result } = await setup()
    await act(() => result.current.loadApprovals('a1'))

    let ok = true
    await act(async () => {
      ok = await result.current.approve('a1', '1.0')
    })

    expect(ok).toBe(false)
    expect(result.current.approvals.a1!.find((a) => a.version_tag === '1.0')!.status).toBe('pending')
  })

  it('reject stores the trimmed reason and decrements the pending count', async () => {
    vi.mocked(appApi.admin.rejectVersion).mockResolvedValue({} as any)
    const { result } = await setup()
    await act(() => result.current.loadApprovals('a1'))

    await act(async () => {
      await result.current.reject('a1', '1.0', '  too risky ')
    })

    expect(appApi.admin.rejectVersion).toHaveBeenCalledWith('a1', '1.0', 'too risky')
    const entry = result.current.approvals.a1!.find((a) => a.version_tag === '1.0')!
    expect(entry.status).toBe('rejected')
    expect(entry.rejection_reason).toBe('too risky')
    expect(result.current.pendingCount.a1).toBe(0)
  })

  it('revoke rejects an approved version without changing the pending count', async () => {
    vi.mocked(appApi.admin.revokeVersion).mockResolvedValue({} as any)
    const { result } = await setup()
    await act(() => result.current.loadApprovals('a1'))

    await act(async () => {
      await result.current.revoke('a1', '0.9', 'security')
    })

    expect(appApi.admin.revokeVersion).toHaveBeenCalledWith('a1', '0.9', 'security')
    expect(result.current.approvals.a1!.find((a) => a.version_tag === '0.9')!.status).toBe('rejected')
    expect(result.current.pendingCount.a1).toBe(1)
  })

  it('does nothing for a blank reason', async () => {
    const { result } = await setup()
    let ok = true
    await act(async () => {
      ok = await result.current.reject('a1', '1.0', '   ')
    })
    expect(ok).toBe(false)
    expect(appApi.admin.rejectVersion).not.toHaveBeenCalled()
  })
})
