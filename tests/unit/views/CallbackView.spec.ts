import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CallbackView from '@/views/CallbackView.vue'

const mocks = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockHandleCallback: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.mockPush }),
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ handleCallback: mocks.mockHandleCallback }),
}))

function mountView() {
  return mount(CallbackView, { global: { stubs: { Loader2: true } } })
}

beforeEach(() => {
  mocks.mockPush.mockClear()
  mocks.mockHandleCallback.mockReset()
})

describe('CallbackView', () => {
  it('shows a spinner while the callback is in flight', () => {
    mocks.mockHandleCallback.mockReturnValue(new Promise(() => {}))
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Completing authentication...')
  })

  it('redirects to the resolved return url on success', async () => {
    mocks.mockHandleCallback.mockResolvedValue('/apps/7')
    mountView()
    await flushPromises()
    expect(mocks.mockPush).toHaveBeenCalledWith('/apps/7')
  })

  it('falls back to the dashboard when no return url is resolved', async () => {
    mocks.mockHandleCallback.mockResolvedValue(undefined)
    mountView()
    await flushPromises()
    expect(mocks.mockPush).toHaveBeenCalledWith('/dashboard')
  })

  describe('on failure', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })
    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it('shows the error message and redirects to /login after a delay', async () => {
      mocks.mockHandleCallback.mockRejectedValue(new Error('invalid state'))
      const wrapper = mountView()
      await flushPromises()

      expect(wrapper.text()).toContain('Authentication Error')
      expect(wrapper.text()).toContain('invalid state')
      expect(mocks.mockPush).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(3000)
      expect(mocks.mockPush).toHaveBeenCalledWith('/login')
    })

    it('falls back to a generic message when the error has none', async () => {
      mocks.mockHandleCallback.mockRejectedValue({})
      const wrapper = mountView()
      await flushPromises()
      expect(wrapper.text()).toContain('Authentication failed')
    })
  })
})
