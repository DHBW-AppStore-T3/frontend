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
  success: (message: string, duration?: number) => string
  error: (message: string, duration?: number) => string
  warning: (message: string, duration?: number) => string
  info: (message: string, duration?: number) => string
  clear: () => void
}

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],

  addToast(toast) {
    const id = Math.random().toString(36).substring(2, 9)
    const duration = toast.duration || 5000

    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))

    setTimeout(() => {
      get().removeToast(id)
    }, duration)

    return id
  },

  removeToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },

  success: (message, duration) => get().addToast({ message, type: 'success', duration }),
  error: (message, duration) => get().addToast({ message, type: 'error', duration }),
  warning: (message, duration) => get().addToast({ message, type: 'warning', duration }),
  info: (message, duration) => get().addToast({ message, type: 'info', duration }),

  clear() {
    set({ toasts: [] })
  },
}))
