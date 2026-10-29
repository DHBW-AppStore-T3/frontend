import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { ReactNode } from 'react'

const mocks = vi.hoisted(() => ({ getById: vi.fn(), navigate: vi.fn(), error: vi.fn() }))

vi.mock('@/api/app.api', () => ({ appApi: { getById: mocks.getById, listVersionApprovals: vi.fn() } }))
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useNavigate: () => mocks.navigate }))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ error: mocks.error, success: vi.fn(), info: vi.fn(), warning: vi.fn() }) }))

import { useAppDetail } from '../useAppDetail'

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>

beforeEach(() => Object.values(mocks).forEach((m) => m.mockReset()))

describe('useAppDetail: answer of GET /apps/{id} is checked (issue 143)', () => {
  it('shows the app without a field of the wrong type', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.getById.mockResolvedValue({ data: { appId: 'a1', name: 'x', versions: 'v1' } })
    const { result } = renderHook(() => useAppDetail('a1', () => false), { wrapper })

    await waitFor(() => expect(result.current.app).toEqual({ appId: 'a1', name: 'x' }))
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('treats an answer without appId like a failed load', async () => {
    mocks.getById.mockResolvedValue({ data: { name: 'no id' } })
    renderHook(() => useAppDetail('a1', () => false), { wrapper })

    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1))
    expect(mocks.navigate).toHaveBeenCalledWith('/apps')
  })
})
