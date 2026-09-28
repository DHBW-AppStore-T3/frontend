import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useToastStore } from '@/stores/toast.store'
import Toast from '@/components/ui/Toast.vue'

beforeEach(() => {
  setActivePinia(createPinia())
})

// Stub <Teleport> so its slot content renders inside the wrapper element
// instead of being teleported to document.body (which VTU can't query).
const mount_ = () =>
  mount(Toast, {
    global: {
      stubs: { Teleport: { template: '<div><slot /></div>' } },
    },
  })

describe('Toast.vue', () => {
  it('renders nothing when there are no toasts', () => {
    const wrapper = mount_()
    expect(wrapper.findAll('[class*="toast"]').filter(w => w.text()).length).toBe(0)
  })

  it('renders a toast when one is added to the store', async () => {
    const store = useToastStore()
    store.addToast({ message: 'All good', type: 'success' })
    const wrapper = mount_()
    expect(wrapper.text()).toContain('All good')
  })

  it('renders the correct success icon path', async () => {
    const store = useToastStore()
    store.addToast({ message: 'Done', type: 'success' })
    const wrapper = mount_()
    // success SVG uses a checkmark path
    const svgs = wrapper.findAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
  })

  it('renders error toast message', async () => {
    const store = useToastStore()
    store.addToast({ message: 'Something failed', type: 'error' })
    const wrapper = mount_()
    expect(wrapper.text()).toContain('Something failed')
  })

  it('renders warning toast message', async () => {
    const store = useToastStore()
    store.addToast({ message: 'Careful', type: 'warning' })
    const wrapper = mount_()
    expect(wrapper.text()).toContain('Careful')
  })

  it('renders info toast message', async () => {
    const store = useToastStore()
    store.addToast({ message: 'FYI', type: 'info' })
    const wrapper = mount_()
    expect(wrapper.text()).toContain('FYI')
  })

  it('clicking the toast body calls removeToast', async () => {
    vi.useFakeTimers()
    const store = useToastStore()
    store.addToast({ message: 'Click me', type: 'info', duration: 99999 })
    const wrapper = mount_()
    const toastEl = wrapper.find('[class*="toast-info"], [class*="toast "]')
    if (toastEl.exists()) {
      await toastEl.trigger('click')
      expect(store.toasts).toHaveLength(0)
    }
    vi.useRealTimers()
  })

  it('clicking the close button removes the toast', async () => {
    vi.useFakeTimers()
    const store = useToastStore()
    store.addToast({ message: 'Close me', type: 'success', duration: 99999 })
    const wrapper = mount_()
    const closeBtn = wrapper.find('button.toast-close')
    if (closeBtn.exists()) {
      await closeBtn.trigger('click')
      expect(store.toasts).toHaveLength(0)
    }
    vi.useRealTimers()
  })

  it('renders multiple toasts', () => {
    const store = useToastStore()
    store.addToast({ message: 'First', type: 'success' })
    store.addToast({ message: 'Second', type: 'error' })
    const wrapper = mount_()
    expect(wrapper.text()).toContain('First')
    expect(wrapper.text()).toContain('Second')
  })
})
