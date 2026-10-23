import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/services/keycloak.service', () => ({
  keycloak: {
    getState: () => ({ isAuthenticated: false }),
    subscribe: vi.fn(() => () => {}),
    login: vi.fn(),
    logout: vi.fn(),
    initialize: vi.fn(),
  },
}))

import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'

describe('useAuth', () => {
  it('exposes the auth store state and reacts to changes', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)

    act(() => {
      useAuthStore.setState({ user: { userId: 'u1', role: 'admin' } as any, isAuthenticated: true })
    })

    expect(result.current.user?.userId).toBe('u1')
    expect(result.current.isAuthenticated).toBe(true)
  })
})

describe('useToast', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('forwards to the toast store and keeps a stable identity', () => {
    const { result, rerender } = renderHook(() => useToast())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)

    act(() => {
      result.current.success('saved')
      result.current.error('boom')
    })

    expect(useToastStore.getState().toasts.map((t) => [t.type, t.message])).toEqual([
      ['success', 'saved'],
      ['error', 'boom'],
    ])

    act(() => result.current.clear())
    expect(useToastStore.getState().toasts).toEqual([])
  })
})
