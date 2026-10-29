import { useState, type CSSProperties, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router'
import { House, LayoutGrid, User, Layers, GraduationCap, HelpCircle, ShieldCheck, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRole } from '@/composables/useRole'
import { useTheme } from '@/theme/useTheme'
import AppSidebar from './AppSidebar'
import AppHeader from './AppHeader'
import type { NavItem } from './nav'
import '@/theme/workspace.css'

function pageTitleKey(path: string): string | null {
  if (path === '/' || path === '/dashboard') return 'nav.dashboard'
  if (path.startsWith('/deployments')) return 'nav.deployments'
  if (path.startsWith('/apps')) return 'nav.apps'
  if (path.startsWith('/courses')) return 'nav.courses'
  if (path === '/help') return 'nav.help'
  if (path === '/admin/apps') return 'nav.approvals'
  if (path === '/admin/settings') return 'nav.adminSettings'
  return null
}

/** Layout shell; renders `children` or, as a route layout, the matched child route. */
export default function AppLayout({ children }: { children?: ReactNode }) {
  const { t } = useTranslation()
  const { isAdmin, isStaff } = useRole()
  const { pathname } = useLocation()
  const theme = useTheme()

  const isDashboard = pathname === '/dashboard' || pathname === '/'

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const titleKey = pageTitleKey(pathname)
  const pageTitle = titleKey ? t(titleKey) : ''

  const navItems: (NavItem & { visible?: boolean })[] = [
    { to: '/', label: 'nav.dashboard', icon: House },
    { to: '/deployments', label: 'nav.deployments', icon: Layers },
    { to: '/apps', label: 'nav.apps', icon: LayoutGrid },
    { to: '/courses', label: 'nav.courses', icon: GraduationCap, visible: isStaff },
    { to: '/admin/apps', label: 'nav.approvals', icon: ShieldCheck, visible: isAdmin },
    { to: '/admin/settings', label: 'nav.adminSettings', icon: Settings, visible: isAdmin },
    { to: '/user', label: 'workspace.profile', icon: User, visible: pathname.startsWith('/user') },
    { to: '/help', label: 'nav.help', icon: HelpCircle },
  ].filter((item) => item.visible !== false)

  const workspaceStyle = theme.loginBackground
    ? ({ '--workspace-dashboard-image': `url(${theme.loginBackground})` } as CSSProperties)
    : undefined

  return (
    <div className="app-shell">
      <AppSidebar
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        navItems={navItems}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div
        className={`app-workspace${isDashboard ? ' app-workspace--dashboard' : ''}`}
        style={workspaceStyle}
      >
        <AppHeader
          pageTitle={pageTitle}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="app-main">{children ?? <Outlet />}</main>
      </div>
    </div>
  )
}
