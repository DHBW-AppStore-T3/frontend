import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppHeader from '@/layouts/AppHeader'
import { useAuthStore } from '@/stores/auth.store'
import { renderWithProviders } from '../../helpers/render'

vi.mock('@/services/keycloak.service', () => ({
  keycloak: {
    getState: () => ({ isAuthenticated: true }),
    subscribe: () => () => {},
    logout: vi.fn(),
  },
}))

function renderHeader(props: Partial<React.ComponentProps<typeof AppHeader>> = {}) {
  return renderWithProviders(
    <AppHeader
      pageTitle="Dashboard"
      sidebarCollapsed={false}
      onToggleSidebar={() => {}}
      onOpenMobileMenu={() => {}}
      {...props}
    />,
  )
}

describe('AppHeader', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null })
  })

  it('renders as a <header> element', () => {
    const { container } = renderHeader()
    expect(container.firstElementChild?.tagName).toBe('HEADER')
  })

  it('shows the page title without fixed positioning', () => {
    const { container } = renderHeader({ pageTitle: 'Deployments' })
    expect(screen.getByText('Deployments')).toBeInTheDocument()
    expect(container.innerHTML).not.toContain('position: fixed')
    expect(container.innerHTML).not.toMatch(/header-title/)
  })

  it('calls onToggleSidebar when the sidebar toggle button is clicked', async () => {
    const onToggleSidebar = vi.fn()
    renderHeader({ sidebarCollapsed: false, onToggleSidebar })

    await userEvent.click(screen.getByLabelText('workspace.closeSidebar'))

    expect(onToggleSidebar).toHaveBeenCalledTimes(1)
  })

  it('uses the open label when the sidebar is collapsed', () => {
    renderHeader({ sidebarCollapsed: true })
    expect(screen.getByLabelText('workspace.openSidebar')).toBeInTheDocument()
  })

  it('calls onOpenMobileMenu when the hamburger button is clicked', async () => {
    const onOpenMobileMenu = vi.fn()
    renderHeader({ onOpenMobileMenu })

    await userEvent.click(screen.getByTestId('mobile-menu-toggle'))

    expect(onOpenMobileMenu).toHaveBeenCalledTimes(1)
  })

  it('shows the user initial and name, falling back to the profile label', () => {
    useAuthStore.setState({ user: { username: 'lea', userId: '1' } as any })
    const { unmount } = renderHeader()
    expect(screen.getByText('lea')).toBeInTheDocument()
    expect(screen.getByText('L')).toBeInTheDocument()
    unmount()

    useAuthStore.setState({ user: null })
    renderHeader()
    expect(screen.getByText('workspace.profile')).toBeInTheDocument()
  })

  it('opens the account menu, closes it on outside click and on Escape', async () => {
    renderHeader()
    const trigger = screen.getByRole('button', { expanded: false })

    await userEvent.click(trigger)
    expect(screen.getByRole('link', { name: 'workspace.profile' })).toHaveAttribute('href', '/user')

    await userEvent.click(document.body)
    expect(screen.queryByRole('link', { name: 'workspace.profile' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { expanded: false }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('link', { name: 'workspace.profile' })).not.toBeInTheDocument()
  })

  it('logs out through the auth store and closes the menu', async () => {
    const logout = vi.fn(() => Promise.resolve())
    useAuthStore.setState({ logout } as any)
    renderHeader()

    await userEvent.click(screen.getByRole('button', { expanded: false }))
    await userEvent.click(screen.getByRole('button', { name: 'workspace.logout' }))

    expect(logout).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'workspace.logout' })).not.toBeInTheDocument()
  })
})
