import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useToastStore, type Toast as ToastItem } from '@/stores/toast.store'
import './Toast.css'

const ICON_PATHS: Record<string, string> = {
  success:
    'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z',
  error:
    'M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z',
  warning:
    'M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z',
  info: 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z',
}

const CLOSE_PATH =
  'M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'

// Errors and warnings interrupt (`alert`), the rest waits for a pause in the
// speech (`status`). The role sits on the message only, so a screen reader
// reads the text and not the close button, and every toast is announced once.
const liveRole = (type: ToastItem['type']) => (type === 'error' || type === 'warning' ? 'alert' : 'status')

export default function Toast() {
  const { t } = useTranslation()
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  return createPortal(
    <div className="toast-container">
      {toasts.map((toast) => (
        // Clicking anywhere on the toast closes it: a mouse shortcut. The keyboard
        // and screen-reader way to the same action is the close button below.
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          onClick={() => removeToast(toast.id)}
        >
          <div className="toast-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d={ICON_PATHS[toast.type] ?? ICON_PATHS.info} clipRule="evenodd" />
            </svg>
          </div>
          <div className="toast-content" role={liveRole(toast.type)}>
            <p className="toast-message">{toast.message}</p>
          </div>
          <button
            type="button"
            className="toast-close"
            aria-label={t('toast.close')}
            onClick={(e) => {
              e.stopPropagation()
              removeToast(toast.id)
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d={CLOSE_PATH} clipRule="evenodd" />
            </svg>
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
}
