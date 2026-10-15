import { Link, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/theme/useTheme'
import LanguageSwitch from '@/components/ui/LanguageSwitch'
import type { NavItem } from './nav'

export interface SidebarNavigationProps {
  collapsed: boolean
  navItems: NavItem[]
  onNavigate?: () => void
}

function isActive(to: string, pathname: string): boolean {
  return to === '/'
    ? pathname === '/' || pathname === '/dashboard'
    : pathname === to || pathname.startsWith(`${to}/`)
}

export default function SidebarNavigation({ collapsed, navItems, onNavigate }: SidebarNavigationProps) {
  const { logo } = useTheme()
  const { pathname } = useLocation()
  const { t } = useTranslation()

  return (
    <aside className={`app-sidebar${collapsed ? ' app-sidebar--collapsed' : ''}`}>
      <Link to="/" className="sidebar-brand" onClick={onNavigate}>
        <span className="sidebar-brand-mark" style={{ maskImage: `url(${logo.src})` }}>
          <img src={logo.src} alt={logo.alt} />
        </span>
      </Link>
      <nav className="sidebar-nav" aria-label={t('workspace.navigation')}>
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.label}
              to={item.to}
              className={`nav-link${isActive(item.to, pathname) ? ' nav-link-active' : ''}`}
              title={collapsed ? t(item.label) : undefined}
              onClick={onNavigate}
            >
              <Icon size={19} strokeWidth={1.5} aria-hidden="true" />
              <span className={collapsed ? 'sr-only' : undefined}>{t(item.label)}</span>
            </Link>
          )
        })}
      </nav>
      <div className="sidebar-footer">
        <LanguageSwitch />
      </div>
    </aside>
  )
}
