import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Menu, User, LogOut, ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth.store'
import { useAuth } from '@/composables/useAuth'

export interface AppHeaderProps {
  pageTitle: string
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  onOpenMobileMenu: () => void
}

export default function AppHeader({
  pageTitle,
  sidebarCollapsed,
  onToggleSidebar,
  onOpenMobileMenu,
}: AppHeaderProps) {
  const { t } = useTranslation()
  const username = useAuthStore((s) => s.user?.username)
  const { logout } = useAuth()
  const userName = username || t('workspace.profile')
  const userInitial = userName.charAt(0).toUpperCase()

  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener('click', closeOnOutsideClick)
    return () => document.removeEventListener('click', closeOnOutsideClick)
  }, [])

  const ToggleIcon = sidebarCollapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <header className="app-header">
      <button
        data-testid="mobile-menu-toggle"
        type="button"
        className="icon-button md:hidden"
        aria-label={t('workspace.openMenu')}
        onClick={onOpenMobileMenu}
      >
        <Menu size={20} />
      </button>
      <button
        type="button"
        className="icon-button sidebar-collapse hidden md:inline-flex"
        aria-label={t(sidebarCollapsed ? 'workspace.openSidebar' : 'workspace.closeSidebar')}
        onClick={onToggleSidebar}
      >
        <ToggleIcon size={18} />
      </button>
      <span className="sr-only">{pageTitle}</span>
      <div
        ref={menuRef}
        className="user-menu-root"
        onKeyDown={(e) => {
          if (e.key === 'Escape') setUserMenuOpen(false)
        }}
      >
        <button
          type="button"
          className="user-menu-trigger"
          aria-expanded={userMenuOpen}
          aria-controls="account-menu"
          onClick={() => setUserMenuOpen((open) => !open)}
        >
          <span className="user-avatar">{userInitial}</span>
          <span className="user-menu-name">{userName}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
        {userMenuOpen ? (
          <div id="account-menu" className="user-menu-panel">
            <Link to="/user" onClick={() => setUserMenuOpen(false)}>
              <User size={16} />
              {t('workspace.profile')}
            </Link>
            <button
              type="button"
              onClick={() => {
                void logout()
                setUserMenuOpen(false)
              }}
            >
              <LogOut size={16} />
              {t('workspace.logout')}
            </button>
          </div>
        ) : null}
      </div>
    </header>
  )
}
