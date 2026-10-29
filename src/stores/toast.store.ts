import { create } from 'zustand'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  /** Stops the auto-removal timer (pointer over or focus inside the toast). */
  pauseToast: (id: string) => void
  /** Restarts the timer with the time that was left, at least `MIN_RESUME_MS`. */
  resumeToast: (id: string) => void
  success: (message: string, duration?: number) => string
  error: (message: string, duration?: number) => string
  warning: (message: string, duration?: number) => string
  info: (message: string, duration?: number) => string
  clear: () => void
}

// WCAG 2.2.1 (adjustable time limit): a toast that disappears while someone is
// reading it or holds focus on its close button cannot be used. The timer stops
// while the pointer is over the toast or focus is inside it, and starts again
// with the remaining time, but never with less than MIN_RESUME_MS.
const DEFAULT_DURATION_MS = 5000
const MIN_RESUME_MS = 2000

interface Timer {
  handle: ReturnType<typeof setTimeout> | null
  remaining: number
  startedAt: number
}

const timers = new Map<string, Timer>()

export const useToastStore = create<ToastState>()((set, get) => {
  const start = (id: string, ms: number) => {
    const handle = setTimeout(() => get().removeToast(id), ms)
    timers.set(id, { handle, remaining: ms, startedAt: Date.now() })
  }

  return {
    toasts: [],

    addToast(toast) {
      const id = Math.random().toString(36).substring(2, 9)

      set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
      start(id, toast.duration || DEFAULT_DURATION_MS)

      return id
    },

    removeToast(id) {
      const timer = timers.get(id)
      if (timer?.handle) clearTimeout(timer.handle)
      timers.delete(id)
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    },

    pauseToast(id) {
      const timer = timers.get(id)
      if (!timer?.handle) return
      clearTimeout(timer.handle)
      timers.set(id, {
        handle: null,
        remaining: Math.max(timer.remaining - (Date.now() - timer.startedAt), 0),
        startedAt: 0,
      })
    },

    resumeToast(id) {
      const timer = timers.get(id)
      if (!timer || timer.handle) return
      start(id, Math.max(timer.remaining, MIN_RESUME_MS))
    },

    success: (message, duration) => get().addToast({ message, type: 'success', duration }),
    error: (message, duration) => get().addToast({ message, type: 'error', duration }),
    warning: (message, duration) => get().addToast({ message, type: 'warning', duration }),
    info: (message, duration) => get().addToast({ message, type: 'info', duration }),

    clear() {
      for (const timer of timers.values()) if (timer.handle) clearTimeout(timer.handle)
      timers.clear()
      set({ toasts: [] })
    },
  }
})
