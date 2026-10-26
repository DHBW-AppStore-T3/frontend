import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
vi.mock('@/services/keycloak.service', () => ({
  keycloak: { getState: () => ({ isAuthenticated: true }), subscribe: () => () => {} },
}))
vi.mock('@/api/app.api', () => ({
  appApi: { list: vi.fn(), admin: { setRecommended: vi.fn() } },
}))

import { appApi } from '@/api/app.api'
import { useToastStore } from '@/stores/toast.store'
import AdminSettingsView from '@/views/AdminSettingsView'
import { useAuthStore } from '@/stores/auth.store'
import { useAdminViewStore } from '@/stores/admin-view.store'
import { renderWithProviders } from '../../helpers/render'

beforeEach(() => {
  vi.clearAllMocks()
  useToastStore.setState({ toasts: [] })
  vi.mocked(appApi.list).mockResolvedValue({ data: [] } as any)
  localStorage.clear()
  useAdminViewStore.setState({ enabledByAccount: {} })
  useAuthStore.setState({ user: { userId: 'a1', role: 'admin' } as any })
})

describe('AdminSettingsView', () => {
  it('shows the admin view switch off by default', () => {
    renderWithProviders(<AdminSettingsView />)
    expect(screen.getByRole('switch', { name: 'AdminSettingsView.adminView.title' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('toggles the switch on and off and writes the store per account', async () => {
    renderWithProviders(<AdminSettingsView />)
    const toggle = screen.getByRole('switch')

    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(useAdminViewStore.getState().enabledByAccount).toEqual({ a1: true })

    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(useAdminViewStore.getState().enabledByAccount).toEqual({ a1: false })
  })

  describe('recommended apps card', () => {
    const apps = [
      { appId: 'app-1', name: 'Alpha', recommended: false },
      { appId: 'app-2', name: 'Beta', recommended: true },
    ]
    it('shows one switch per app with its current value', async () => {
      vi.mocked(appApi.list).mockResolvedValue({ data: apps } as any)
      renderWithProviders(<AdminSettingsView />)
      expect(await screen.findByText('Alpha')).toBeInTheDocument()
      const switches = screen.getAllByRole('switch').filter((s) => s.getAttribute('aria-label')?.includes('recommended'))
      expect(switches.map((s) => s.getAttribute('aria-checked'))).toEqual(['false', 'true'])
    })

    it('calls setRecommended and shows the new value', async () => {
      vi.mocked(appApi.list).mockResolvedValue({ data: apps } as any)
      vi.mocked(appApi.admin.setRecommended).mockResolvedValue({ data: { ...apps[0], recommended: true } } as any)
      renderWithProviders(<AdminSettingsView />)
      await screen.findByText('Alpha')
      const sw = screen.getAllByRole('switch').filter((s) => s.getAttribute('aria-label')?.includes('recommended'))[0]!
      await userEvent.click(sw)
      expect(appApi.admin.setRecommended).toHaveBeenCalledWith('app-1', true)
      await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'true'))
    })

    it('keeps the old value and shows an error toast on failure', async () => {
      vi.mocked(appApi.list).mockResolvedValue({ data: apps } as any)
      vi.mocked(appApi.admin.setRecommended).mockRejectedValue(new Error('boom'))
      renderWithProviders(<AdminSettingsView />)
      await screen.findByText('Alpha')
      const sw = screen.getAllByRole('switch').filter((s) => s.getAttribute('aria-label')?.includes('recommended'))[0]!
      await userEvent.click(sw)
      await waitFor(() =>
        expect(useToastStore.getState().toasts.some((t) => t.message === 'AdminSettingsView.recommended.error')).toBe(true),
      )
      expect(sw).toHaveAttribute('aria-checked', 'false')
    })

    it('shows the empty state when there are no apps', async () => {
      renderWithProviders(<AdminSettingsView />)
      expect(await screen.findByText('AdminSettingsView.recommended.empty')).toBeInTheDocument()
    })
  })
})
