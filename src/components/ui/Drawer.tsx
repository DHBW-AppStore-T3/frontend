import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useOverlay } from '@/composables/useOverlay'
import './Drawer.css'

export interface DrawerProps {
  show: boolean
  onClose: () => void
  side?: 'left' | 'right'
  /** Accessible name of the dialog. Without it (and without ``labelledBy``) a generic name is used. */
  label?: string
  /** ID of a visible heading inside the drawer; wins over ``label``. */
  labelledBy?: string
  children?: ReactNode
}

export default function Drawer({ show, onClose, side = 'left', label, labelledBy, children }: DrawerProps) {
  const { t } = useTranslation()
  const { containerRef } = useOverlay({ show, onClose })

  if (!show) return null

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop click is a mouse shortcut; Escape and the focus trap live in useOverlay
    <div
      className="fixed inset-0 bg-black/20 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={containerRef}
        data-drawer-panel
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : (label ?? t('dialog.panelLabel', { defaultValue: 'Side panel' }))}
        tabIndex={-1}
        className={[
          'absolute top-0 h-full w-full max-w-xs bg-white shadow-xl flex flex-col animate-drawer-slide focus:outline-none',
          side === 'right' ? 'right-0' : 'left-0',
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  )
}
