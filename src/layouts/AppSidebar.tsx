import { useEffect, useState } from 'react'
import Drawer from '@/components/ui/Drawer'
import SidebarNavigation from './SidebarNavigation'
import type { NavItem } from './nav'

export interface AppSidebarProps {
  collapsed: boolean
  navItems: NavItem[]
  mobileOpen: boolean
  onCollapsedChange: (value: boolean) => void
  onCloseMobile: () => void
}

const MOBILE_BREAKPOINT = 768

export default function AppSidebar({ collapsed, navItems, mobileOpen, onCloseMobile }: AppSidebarProps) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT)

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  if (isMobile) {
    return (
      <Drawer show={mobileOpen} side="left" onClose={onCloseMobile}>
        <SidebarNavigation collapsed={false} navItems={navItems} onNavigate={onCloseMobile} />
      </Drawer>
    )
  }

  return <SidebarNavigation collapsed={collapsed} navItems={navItems} />
}
