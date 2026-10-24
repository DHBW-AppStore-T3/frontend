import { describe, it, expect, beforeEach } from 'vitest'
import { ADMIN_VIEW_STORAGE_KEY, useAdminViewStore } from '@/stores/admin-view.store'

beforeEach(() => {
  localStorage.clear()
  useAdminViewStore.setState({ enabledByAccount: {} })
})

describe('admin-view store', () => {
  it('has no entry by default', () => {
    expect(useAdminViewStore.getState().enabledByAccount).toEqual({})
  })

  it('setEnabled only touches the given account', () => {
    useAdminViewStore.getState().setEnabled('a1', true)
    expect(useAdminViewStore.getState().enabledByAccount).toEqual({ a1: true })
    expect(useAdminViewStore.getState().enabledByAccount['a2']).toBeUndefined()
  })

  it('persists under appstore.adminView', () => {
    expect(ADMIN_VIEW_STORAGE_KEY).toBe('appstore.adminView')
    useAdminViewStore.getState().setEnabled('a1', true)
    const raw = localStorage.getItem('appstore.adminView')
    expect(JSON.parse(raw as string).state.enabledByAccount).toEqual({ a1: true })
  })
})
