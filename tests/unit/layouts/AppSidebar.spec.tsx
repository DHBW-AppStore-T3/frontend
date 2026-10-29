import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LayoutDashboard } from 'lucide-react'
import AppSidebar from '@/layouts/AppSidebar'
import { applyTheme } from '@/theme/applyTheme'
import { THEMES } from '@/theme'
import { renderWithProviders } from '../../helpers/render'

const navItems = [{ to: '/', label: 'nav.dashboard', icon: LayoutDashboard }]

function renderSidebar(props: Partial<React.ComponentProps<typeof AppSidebar>> = {}) {
  return renderWithProviders(
    <AppSidebar
      collapsed={false}
      mobileOpen={false}
      navItems={navItems}
      onCollapsedChange={() => {}}
      onCloseMobile={() => {}}
      {...props}
    />,
  )
}

const ORIGINAL_WIDTH = window.innerWidth

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })
  act(() => {
    window.dispatchEvent(new Event('resize'))
  })
}

describe('AppSidebar', () => {
  beforeEach(() => {
    applyTheme(THEMES.t3!)
  })

  afterEach(() => {
    setViewportWidth(ORIGINAL_WIDTH)
  })

  it('renders as an <aside> permanent column at desktop width (>= 768px)', () => {
    setViewportWidth(1024)
    const { container } = renderSidebar()
    expect(container.querySelector('aside')).not.toBeNull()
  })

  it('renders the logo from the active theme', () => {
    setViewportWidth(1024)
    const { container } = renderSidebar()
    expect(container.querySelector('img')).toHaveAttribute('src', THEMES.t3!.logo.src)
  })

  it('renders nav items with their translation key label', () => {
    setViewportWidth(1024)
    renderSidebar()
    expect(screen.getByText('nav.dashboard')).toBeInTheDocument()
  })

  it('hides the label visually but keeps it for screen readers when collapsed', () => {
    setViewportWidth(1024)
    renderSidebar({ collapsed: true })
    expect(screen.getByText('nav.dashboard')).toHaveClass('sr-only')
    expect(screen.getByRole('link', { name: 'nav.dashboard' })).toHaveAttribute('title', 'nav.dashboard')
  })

  it('switches to a Drawer-based mobile mode below 768px', () => {
    setViewportWidth(500)
    const { container } = renderSidebar({ mobileOpen: true })
    expect(container.querySelector('[data-drawer-panel]')).not.toBeNull()
  })

  it('renders nothing for the closed mobile drawer', () => {
    setViewportWidth(500)
    const { container } = renderSidebar({ mobileOpen: false })
    expect(container.querySelector('aside')).toBeNull()
    expect(container.querySelector('[data-drawer-panel]')).toBeNull()
  })

  it('calls onCloseMobile when the mobile drawer closes', async () => {
    setViewportWidth(500)
    const onCloseMobile = vi.fn()
    const { container } = renderSidebar({ mobileOpen: true, onCloseMobile })

    await userEvent.click(container.firstElementChild as HTMLElement) // backdrop

    expect(onCloseMobile).toHaveBeenCalledTimes(1)
  })

  it('closes the mobile drawer after navigating', async () => {
    setViewportWidth(500)
    const onCloseMobile = vi.fn()
    renderSidebar({ mobileOpen: true, onCloseMobile })

    await userEvent.click(screen.getByRole('link', { name: 'nav.dashboard' }))

    expect(onCloseMobile).toHaveBeenCalled()
  })

  it('marks the item for the current path as active', () => {
    setViewportWidth(1024)
    renderWithProviders(
      <AppSidebar
        collapsed={false}
        mobileOpen={false}
        onCollapsedChange={() => {}}
        onCloseMobile={() => {}}
        navItems={[
          { to: '/', label: 'nav.dashboard', icon: LayoutDashboard },
          { to: '/apps', label: 'nav.apps', icon: LayoutDashboard },
        ]}
      />,
      { route: '/apps/42' },
    )
    expect(screen.getByRole('link', { name: 'nav.apps' })).toHaveClass('nav-link-active')
    expect(screen.getByRole('link', { name: 'nav.dashboard' })).not.toHaveClass('nav-link-active')
  })
})
