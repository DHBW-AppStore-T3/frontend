import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { ReactNode } from 'react'

const mocks = vi.hoisted(() => ({
  getById: vi.fn(),
  listVersionApprovals: vi.fn(),
  navigate: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/api/app.api', () => ({
  appApi: { getById: mocks.getById, listVersionApprovals: mocks.listVersionApprovals },
}))
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useNavigate: () => mocks.navigate }))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ error: mocks.error, success: vi.fn(), info: vi.fn(), warning: vi.fn() }) }))

import { useAppDetail } from '../useAppDetail'

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset())
  mocks.listVersionApprovals.mockResolvedValue({ data: [{ version: '1', status: 'approved' }] })
})

// The initial load used to carry an exhaustive-deps disable (issue 142). It must
// restart for a new app and for nothing else.
describe('useAppDetail: initial load', () => {
  it('loads the app once and approvals when the caller asks for them', async () => {
    mocks.getById.mockResolvedValue({ data: { appId: 'a1' } })
    const { result } = renderHook(() => useAppDetail('a1', () => true), { wrapper })

    await waitFor(() => expect(result.current.app).toMatchObject({ appId: 'a1' }))
    await waitFor(() => expect(result.current.approvals).toHaveLength(1))
    expect(mocks.getById).toHaveBeenCalledTimes(1)
  })

  it('does not load approvals when the caller says no', async () => {
    mocks.getById.mockResolvedValue({ data: { appId: 'a1' } })
    const { result } = renderHook(() => useAppDetail('a1', () => false), { wrapper })

    await waitFor(() => expect(result.current.app).not.toBeNull())
    expect(mocks.listVersionApprovals).not.toHaveBeenCalled()
  })

  it('does not reload when only the loadsApprovals function changes between renders', async () => {
    mocks.getById.mockResolvedValue({ data: { appId: 'a1' } })
    const { result, rerender } = renderHook(({ fn }) => useAppDetail('a1', fn), {
      wrapper,
      initialProps: { fn: (() => false) as () => boolean },
    })
    await waitFor(() => expect(result.current.app).not.toBeNull())

    rerender({ fn: () => true })
    rerender({ fn: () => false })

    expect(mocks.getById).toHaveBeenCalledTimes(1)
  })

  it('reloads when the app id changes', async () => {
    mocks.getById.mockResolvedValue({ data: { appId: 'x' } })
    const { rerender } = renderHook(({ id }) => useAppDetail(id, () => false), { wrapper, initialProps: { id: 'a1' } })
    await waitFor(() => expect(mocks.getById).toHaveBeenCalledTimes(1))

    rerender({ id: 'a2' })

    await waitFor(() => expect(mocks.getById).toHaveBeenCalledTimes(2))
    expect(mocks.getById).toHaveBeenLastCalledWith('a2', false)
  })

  it('reports a failed load with a toast and goes back to the list', async () => {
    mocks.getById.mockRejectedValue(new Error('nope'))
    renderHook(() => useAppDetail('a1', () => false), { wrapper })

    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1))
    expect(mocks.navigate).toHaveBeenCalledWith('/apps')
  })

  it('ignores an answer that arrives after the id has changed', async () => {
    let resolveFirst!: (v: unknown) => void
    mocks.getById.mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
    mocks.getById.mockResolvedValueOnce({ data: { appId: 'a2' } })
    const { result, rerender } = renderHook(({ id }) => useAppDetail(id, () => false), { wrapper, initialProps: { id: 'a1' } })

    rerender({ id: 'a2' })
    await waitFor(() => expect(result.current.app).toMatchObject({ appId: 'a2' }))
    await act(async () => resolveFirst({ data: { appId: 'a1' } }))

    expect(result.current.app).toMatchObject({ appId: 'a2' })
  })
})
