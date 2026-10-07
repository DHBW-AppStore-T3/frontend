import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPush = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockHandleCallback = vi.fn()

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    handleCallback: mockHandleCallback,
  }),
}))

import CallbackView from '@/views/CallbackView.vue'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const mount_ = () =>
  mount(CallbackView, {
    global: {
      stubs: { Loader2: { template: '<span class="loader-stub" />' } },
    },
  })

describe('CallbackView.vue', () => {
  it('shows loading text while callback is pending', async () => {
    mockHandleCallback.mockReturnValue(new Promise(() => {})) // never resolves
    const wrapper = mount_()
    // do NOT flush — callback is still pending
    expect(wrapper.text()).toContain('Completing authentication...')
  })

  it('redirects to returned URL on success', async () => {
    mockHandleCallback.mockResolvedValue('/apps')
    mount_()
    await flushPromises()
    expect(mockPush).toHaveBeenCalledWith('/apps')
  })

  it('falls back to /dashboard when callback returns null', async () => {
    mockHandleCallback.mockResolvedValue(null)
    mount_()
    await flushPromises()
    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })

  it('shows error message on callback failure', async () => {
    mockHandleCallback.mockRejectedValue(new Error('Token exchange failed'))
    const wrapper = mount_()
    await flushPromises()
    expect(wrapper.text()).toContain('Token exchange failed')
    expect(wrapper.text()).toContain('Authentication Error')
  })

  it('redirects to /login after 3s on error', async () => {
    mockHandleCallback.mockRejectedValue(new Error('Bad callback'))
    mount_()
    await flushPromises()
    expect(mockPush).not.toHaveBeenCalledWith('/login')
    vi.advanceTimersByTime(3000)
    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  it('shows generic error message when error has no message property', async () => {
    mockHandleCallback.mockRejectedValue({})
    const wrapper = mount_()
    await flushPromises()
    expect(wrapper.text()).toContain('Authentication failed')
  })
})
