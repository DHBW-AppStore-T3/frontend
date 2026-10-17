import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppLayout from '@/layouts/AppLayout'
import { useAuthStore } from '@/stores/auth.store'
import { renderWithProviders } from '../../helpers/render'

describe('AppLayout', () => {
  it('composes AppSidebar and AppHeader and renders the children', () => {
    const { container } = renderWithProviders(
      <AppLayout>
        <p>page content</p>
      </AppLayout>,
    )
    expect(container.querySelector('aside')).not.toBeNull()
    expect(container.querySelector('header')).not.toBeNull()
    expect(screen.getByText('page content')).toBeInTheDocument()
  })

  it('toggles the collapsed sidebar state from the header', async () => {
    const { container } = renderWithProviders(<AppLayout />)
    expect(container.querySelector('aside')).not.toHaveClass('app-sidebar--collapsed')

    await userEvent.click(screen.getByLabelText('workspace.closeSidebar'))

    expect(container.querySelector('aside')).toHaveClass('app-sidebar--collapsed')
  })

  it('derives the page title from the current path', () => {
    renderWithProviders(<AppLayout />, { route: '/deployments/abc' })
    expect(screen.getByText('nav.deployments', { selector: '.sr-only' })).toBeInTheDocument()
  })

  it('shows admin/staff-only navigation based on the role', () => {
    useAuthStore.setState({ user: { userId: 'a', role: 'student' } as any })
    const { unmount } = renderWithProviders(<AppLayout />)
    expect(screen.queryByText('nav.courses')).not.toBeInTheDocument()
    expect(screen.queryByText('nav.approvals')).not.toBeInTheDocument()
    unmount()

    useAuthStore.setState({ user: { userId: 'a', role: 'admin' } as any })
    renderWithProviders(<AppLayout />)
    expect(screen.getByText('nav.courses')).toBeInTheDocument()
    expect(screen.getByText('nav.approvals')).toBeInTheDocument()
  })

  it('only lists the profile entry on /user routes', () => {
    useAuthStore.setState({ user: null })
    renderWithProviders(<AppLayout />, { route: '/user' })
    expect(screen.getAllByText('workspace.profile').length).toBeGreaterThan(0)
  })
})
