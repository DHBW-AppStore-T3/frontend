import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useToastStore } from '@/stores/toast.store'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('toast.store', () => {
  it('addToast appends a toast with a generated id', () => {
    const store = useToastStore()
    store.addToast({ message: 'Hello', type: 'success' })
    expect(store.toasts).toHaveLength(1)
    expect(store.toasts[0]!.message).toBe('Hello')
    expect(store.toasts[0]!.type).toBe('success')
    expect(store.toasts[0]!.id).toBeTruthy()
  })

  it('addToast auto-removes toast after default 5000ms', () => {
    const store = useToastStore()
    store.addToast({ message: 'Gone', type: 'info' })
    expect(store.toasts).toHaveLength(1)
    vi.advanceTimersByTime(5000)
    expect(store.toasts).toHaveLength(0)
  })

  it('addToast auto-removes after custom duration', () => {
    const store = useToastStore()
    store.addToast({ message: 'Quick', type: 'warning', duration: 1000 })
    vi.advanceTimersByTime(999)
    expect(store.toasts).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(store.toasts).toHaveLength(0)
  })

  it('removeToast removes by id', () => {
    const store = useToastStore()
    const id = store.addToast({ message: 'X', type: 'error' })
    store.addToast({ message: 'Y', type: 'success' })
    store.removeToast(id)
    expect(store.toasts).toHaveLength(1)
    expect(store.toasts[0]!.message).toBe('Y')
  })

  it('removeToast is a no-op for unknown id', () => {
    const store = useToastStore()
    store.addToast({ message: 'X', type: 'info' })
    store.removeToast('nonexistent')
    expect(store.toasts).toHaveLength(1)
  })

  it('success helper creates success toast and returns id', () => {
    const store = useToastStore()
    const id = store.success('It worked')
    expect(typeof id).toBe('string')
    expect(store.toasts[0]!.type).toBe('success')
    expect(store.toasts[0]!.message).toBe('It worked')
  })

  it('error helper creates error toast', () => {
    const store = useToastStore()
    store.error('Oops')
    expect(store.toasts[0]!.type).toBe('error')
  })

  it('warning helper creates warning toast', () => {
    const store = useToastStore()
    store.warning('Watch out')
    expect(store.toasts[0]!.type).toBe('warning')
  })

  it('info helper creates info toast', () => {
    const store = useToastStore()
    store.info('FYI')
    expect(store.toasts[0]!.type).toBe('info')
  })

  it('clear removes all toasts', () => {
    const store = useToastStore()
    store.success('A')
    store.error('B')
    store.clear()
    expect(store.toasts).toHaveLength(0)
  })

  it('multiple toasts stack independently', () => {
    const store = useToastStore()
    store.success('First')
    store.error('Second')
    store.warning('Third')
    expect(store.toasts).toHaveLength(3)
  })
})
