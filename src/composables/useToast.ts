import { useMemo } from 'react'
import { useToastStore } from '@/stores/toast.store'

export function useToast() {
  return useMemo(() => {
    const store = useToastStore.getState()
    return {
      success: store.success,
      error: store.error,
      warning: store.warning,
      info: store.info,
      clear: store.clear,
    }
  }, [])
}
