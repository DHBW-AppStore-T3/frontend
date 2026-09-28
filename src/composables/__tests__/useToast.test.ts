import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useToast } from '@/composables/useToast'
import { useToastStore } from '@/stores/toast.store'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useToast', () => {
  it('success delegates to toastStore.success', () => {
    const { success } = useToast()
    success('It worked', 3000)
    const store = useToastStore()
    expect(store.toasts[0].message).toBe('It worked')
    expect(store.toasts[0].type).toBe('success')
  })

  it('error delegates to toastStore.error', () => {
    const { error } = useToast()
    error('Something broke')
    expect(useToastStore().toasts[0].type).toBe('error')
    expect(useToastStore().toasts[0].message).toBe('Something broke')
  })

  it('warning delegates to toastStore.warning', () => {
    const { warning } = useToast()
    warning('Watch out')
    expect(useToastStore().toasts[0].type).toBe('warning')
  })

  it('info delegates to toastStore.info', () => {
    const { info } = useToast()
    info('FYI')
    expect(useToastStore().toasts[0].type).toBe('info')
  })

  it('clear delegates to toastStore.clear', () => {
    const store = useToastStore()
    store.success('A')
    store.error('B')
    const { clear } = useToast()
    clear()
    expect(store.toasts).toHaveLength(0)
  })

  it('success without duration uses store default (5000ms auto-remove)', () => {
    const { success } = useToast()
    success('Auto-removes')
    const store = useToastStore()
    expect(store.toasts).toHaveLength(1)
    vi.advanceTimersByTime(5000)
    expect(store.toasts).toHaveLength(0)
  })
})
