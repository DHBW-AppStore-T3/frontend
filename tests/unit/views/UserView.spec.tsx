import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/services/keycloak.service', () => ({
  keycloak: { getState: () => ({ isAuthenticated: true }), subscribe: () => () => {} },
}))

import UserView from '@/views/UserView'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import i18n from '@/i18n'
import de from '@/i18n/locales/de'
import { renderWithProviders } from '../../helpers/render'

const setUser = (user: Record<string, unknown> | null) => useAuthStore.setState({ user } as any)
const renderView = () => renderWithProviders(<UserView />, { realI18n: true })

beforeEach(async () => {
  setUser(null)
  localStorage.clear()
  useToastStore.setState({ toasts: [] })
  await i18n.changeLanguage('de')
})

describe('User profile', () => {
  it('shows a loading state before the account is available', () => {
    renderView()
    expect(screen.getByText(de.UserView.loading)).toBeInTheDocument()
  })

  it('shows account-managed identity in read-only fields and retains account details', () => {
    setUser({
      username: 'maxmuster',
      firstName: 'Max',
      lastName: 'Mustermann',
      email: 'max@example.test',
      role: 'student',
      userId: 'u-1',
      keycloak_id: 'kc-1',
      created_at: '2024-01-15',
      course: { courseId: 'c-1', name: 'Informatik' },
    })
    const { container } = renderView()
    const fields = [...container.querySelectorAll('input')] as HTMLInputElement[]
    expect(fields[0]!.value).toBe('Max Mustermann')
    expect(fields[1]!.value).toBe('max@example.test')
    expect(fields.every((f) => f.readOnly)).toBe(true)
    for (const value of ['maxmuster', 'Informatik', 'u-1', 'kc-1', '2024']) {
      expect(container.textContent).toContain(value)
    }
  })

  it('falls back to the username when personal names are missing', () => {
    setUser({ username: 'minimalist', role: 'admin' })
    const { container } = renderView()
    expect((container.querySelector('input') as HTMLInputElement).value).toBe('minimalist')
  })

  it('saves the language preference without updating account data', async () => {
    const user = { username: 'admin', role: 'admin' }
    setUser(user)
    renderView()

    await userEvent.selectOptions(screen.getByRole('combobox'), 'en')
    await userEvent.click(screen.getByRole('button', { name: /./ }))

    expect(i18n.language).toBe('en')
    expect(localStorage.getItem('locale')).toBe('en')
    expect(useToastStore.getState().toasts).toHaveLength(1)
    expect(useAuthStore.getState().user).toEqual(user)
  })

  it('keeps the credentials settings accessible', () => {
    setUser({ username: 'admin', role: 'admin' })
    renderView()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/user/openstack')
  })
})
