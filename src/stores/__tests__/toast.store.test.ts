import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useToastStore } from '../toast.store'

describe('ToastStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes with no toasts', () => {
    const store = useToastStore()
    expect(store.toasts).toEqual([])
  })

  it('addToast pushes a toast with a generated id and returns that id', () => {
    const store = useToastStore()
    const id = store.addToast({ message: 'hello', type: 'info' })

    expect(typeof id).toBe('string')
    expect(store.toasts).toEqual([{ id, message: 'hello', type: 'info', duration: undefined }])
  })

  it('auto-removes the toast after its duration elapses', () => {
    const store = useToastStore()
    store.addToast({ message: 'bye', type: 'info', duration: 1000 })

    expect(store.toasts).toHaveLength(1)
    vi.advanceTimersByTime(1000)
    expect(store.toasts).toHaveLength(0)
  })

  it('defaults the auto-removal duration to 5000ms', () => {
    const store = useToastStore()
    store.addToast({ message: 'default duration', type: 'info' })

    vi.advanceTimersByTime(4999)
    expect(store.toasts).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(store.toasts).toHaveLength(0)
  })

  it('removeToast removes only the matching toast', () => {
    const store = useToastStore()
    const id1 = store.addToast({ message: 'one', type: 'info', duration: 999999 })
    const id2 = store.addToast({ message: 'two', type: 'info', duration: 999999 })

    store.removeToast(id1)

    expect(store.toasts).toEqual([{ id: id2, message: 'two', type: 'info', duration: 999999 }])
  })

  it('removeToast is a no-op for an unknown id', () => {
    const store = useToastStore()
    store.addToast({ message: 'one', type: 'info', duration: 999999 })

    expect(() => store.removeToast('does-not-exist')).not.toThrow()
    expect(store.toasts).toHaveLength(1)
  })

  it.each([
    ['success', 'success'],
    ['error', 'error'],
    ['warning', 'warning'],
    ['info', 'info'],
  ] as const)('%s() adds a toast of type %s', (method, type) => {
    const store = useToastStore()
    store[method]('message text')

    expect(store.toasts).toHaveLength(1)
    expect(store.toasts[0]!.type).toBe(type)
    expect(store.toasts[0]!.message).toBe('message text')
  })

  it('convenience methods forward an explicit duration', () => {
    const store = useToastStore()
    store.success('saved', 1234)

    expect(store.toasts[0]!.duration).toBe(1234)
  })

  it('clear removes all toasts', () => {
    const store = useToastStore()
    store.addToast({ message: 'one', type: 'info', duration: 999999 })
    store.addToast({ message: 'two', type: 'info', duration: 999999 })

    store.clear()

    expect(store.toasts).toEqual([])
  })
})
