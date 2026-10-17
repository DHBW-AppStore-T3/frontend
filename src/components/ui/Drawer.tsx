import type { ReactNode } from 'react'
import { useOverlay } from '@/composables/useOverlay'
import './Drawer.css'

export interface DrawerProps {
  show: boolean
  onClose: () => void
  side?: 'left' | 'right'
  children?: ReactNode
}

export default function Drawer({ show, onClose, side = 'left', children }: DrawerProps) {
  const { containerRef } = useOverlay({ show, onClose })

  if (!show) return null

  return (
    <div
      className="fixed inset-0 bg-black/20 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={containerRef}
        data-drawer-panel
        className={[
          'absolute top-0 h-full w-full max-w-xs bg-white shadow-xl flex flex-col animate-drawer-slide',
          side === 'right' ? 'right-0' : 'left-0',
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  )
}
