import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminSettingsView from '@/views/AdminSettingsView'
import { useAuthStore } from '@/stores/auth.store'
import { useAdminViewStore } from '@/stores/admin-view.store'
import { renderWithProviders } from '../../helpers/render'

beforeEach(() => {
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
})
