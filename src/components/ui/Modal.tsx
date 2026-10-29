import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useOverlay } from '@/composables/useOverlay'
import './Modal.css'

export interface ModalProps {
  show: boolean
  onClose: () => void
  /** Header content. Wins over ``title``. */
  header?: ReactNode
  /** Alias of ``header`` (used by DeploymentDetailView, AppsDetailView). Both empty falls back to "Modal". */
  title?: ReactNode
  /** Explicit body content. Wins over ``children``. */
  body?: ReactNode
  children?: ReactNode
  footer?: ReactNode
}

export default function Modal({ show, onClose, header, title, body, children, footer }: ModalProps) {
  const { t } = useTranslation()
  const { containerRef } = useOverlay({ show, onClose })
  const titleId = useId()

  if (!show) return null

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop click is a mouse shortcut; Escape and the close button live in useOverlay
    <div
      className="fixed inset-0 bg-black/10 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- keeps clicks inside the dialog from reaching ancestors; not an action */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] animate-fade-in flex flex-col max-h-[90vh] focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-gray-100">
          <div id={titleId} className="text-xl font-semibold text-gray-900 leading-tight pr-4">
            {header ?? title ?? t('dialog.fallbackTitle', { defaultValue: 'Modal' })}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            aria-label={t('dialog.close', { defaultValue: 'Close' })}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-grow">{body ?? children}</div>

        {/* Footer */}
        {footer ? (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">{footer}</div>
        ) : null}
      </div>
    </div>
  )
}
