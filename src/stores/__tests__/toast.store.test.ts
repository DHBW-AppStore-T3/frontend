import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { liveStore, resetStore } from '../../../tests/helpers/liveStore'
import { useToastStore } from '../toast.store'

describe('ToastStore', () => {
  beforeEach(() => {
    resetStore(useToastStore)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes with no toasts', () => {
    const store = liveStore(useToastStore)
    expect(store.toasts).toEqual([])
  })

  it('addToast pushes a toast with a generated id and returns that id', () => {
    const store = liveStore(useToastStore)
    const id = store.addToast({ message: 'hello', type: 'info' })

    expect(typeof id).toBe('string')
    expect(store.toasts).toEqual([{ id, message: 'hello', type: 'info', duration: undefined }])
  })

  it('auto-removes the toast after its duration elapses', () => {
    const store = liveStore(useToastStore)
    store.addToast({ message: 'bye', type: 'info', duration: 1000 })

    expect(store.toasts).toHaveLength(1)
    vi.advanceTimersByTime(1000)
    expect(store.toasts).toHaveLength(0)
  })

  it('defaults the auto-removal duration to 5000ms', () => {
    const store = liveStore(useToastStore)
    store.addToast({ message: 'default duration', type: 'info' })

    vi.advanceTimersByTime(4999)
    expect(store.toasts).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(store.toasts).toHaveLength(0)
  })

  it('removeToast removes only the matching toast', () => {
    const store = liveStore(useToastStore)
    const id1 = store.addToast({ message: 'one', type: 'info', duration: 999999 })
    const id2 = store.addToast({ message: 'two', type: 'info', duration: 999999 })

    store.removeToast(id1)

    expect(store.toasts).toEqual([{ id: id2, message: 'two', type: 'info', duration: 999999 }])
  })

  it('removeToast is a no-op for an unknown id', () => {
    const store = liveStore(useToastStore)
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
    const store = liveStore(useToastStore)
    store[method]('message text')

    expect(store.toasts).toHaveLength(1)
    expect(store.toasts[0]!.type).toBe(type)
    expect(store.toasts[0]!.message).toBe('message text')
  })

  it('convenience methods forward an explicit duration', () => {
    const store = liveStore(useToastStore)
    store.success('saved', 1234)

    expect(store.toasts[0]!.duration).toBe(1234)
  })

  describe('pause and resume (WCAG 2.2.1)', () => {
    it('does not remove a paused toast, however long it waits', () => {
      const store = liveStore(useToastStore)
      const id = store.addToast({ message: 'reading', type: 'info', duration: 1000 })

      vi.advanceTimersByTime(400)
      store.pauseToast(id)
      vi.advanceTimersByTime(60_000)

      expect(store.toasts).toHaveLength(1)
    })

    it('resumes with the time that was left, but not with less than two seconds', () => {
      const store = liveStore(useToastStore)
      const id = store.addToast({ message: 'reading', type: 'info', duration: 5000 })

      vi.advanceTimersByTime(4900) // 100 ms left
      store.pauseToast(id)
      store.resumeToast(id)

      vi.advanceTimersByTime(1999)
      expect(store.toasts).toHaveLength(1)
      vi.advanceTimersByTime(1)
      expect(store.toasts).toHaveLength(0)
    })

    it('resumes with the longer remaining time when more than two seconds are left', () => {
      const store = liveStore(useToastStore)
      const id = store.addToast({ message: 'reading', type: 'info', duration: 5000 })

      vi.advanceTimersByTime(1000) // 4000 ms left
      store.pauseToast(id)
      store.resumeToast(id)

      vi.advanceTimersByTime(3999)
      expect(store.toasts).toHaveLength(1)
      vi.advanceTimersByTime(1)
      expect(store.toasts).toHaveLength(0)
    })

    it('pausing twice, resuming twice or pausing an unknown id changes nothing', () => {
      const store = liveStore(useToastStore)
      const id = store.addToast({ message: 'x', type: 'info', duration: 3000 })

      store.pauseToast('nope')
      store.resumeToast('nope')
      store.pauseToast(id)
      store.pauseToast(id)
      store.resumeToast(id)
      store.resumeToast(id)

      vi.advanceTimersByTime(3000)
      expect(store.toasts).toHaveLength(0)
    })

    it('a removed toast leaves no timer behind that could fire later', () => {
      const store = liveStore(useToastStore)
      const id = store.addToast({ message: 'x', type: 'info', duration: 3000 })
      store.removeToast(id)

      expect(vi.getTimerCount()).toBe(0)
    })

    it('clear cancels the timers of all toasts', () => {
      const store = liveStore(useToastStore)
      store.addToast({ message: 'one', type: 'info' })
      store.addToast({ message: 'two', type: 'info' })

      store.clear()

      expect(vi.getTimerCount()).toBe(0)
    })
  })

  it('clear removes all toasts', () => {
    const store = liveStore(useToastStore)
    store.addToast({ message: 'one', type: 'info', duration: 999999 })
    store.addToast({ message: 'two', type: 'info', duration: 999999 })

    store.clear()

    expect(store.toasts).toEqual([])
  })
})
