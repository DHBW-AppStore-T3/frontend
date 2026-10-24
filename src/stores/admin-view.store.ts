import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const ADMIN_VIEW_STORAGE_KEY = 'appstore.adminView'

interface AdminViewState {
  /** Admin view per account (`userId`); a missing entry means off. */
  enabledByAccount: Record<string, boolean>
  setEnabled: (accountId: string, enabled: boolean) => void
}

export const useAdminViewStore = create<AdminViewState>()(
  persist(
    (set) => ({
      enabledByAccount: {},
      setEnabled: (accountId, enabled) =>
        set((state) => ({ enabledByAccount: { ...state.enabledByAccount, [accountId]: enabled } })),
    }),
    { name: ADMIN_VIEW_STORAGE_KEY, storage: createJSONStorage(() => localStorage) },
  ),
)
