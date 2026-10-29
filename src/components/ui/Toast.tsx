import { useRef, type FocusEvent, type MouseEvent } from 'react'
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

// Announcements go through two permanent, initially empty live regions: errors
// and warnings interrupt (`assertive`), the rest waits for a pause (`polite`). A
// live region that is inserted together with its text is not reliably
// announced, so the regions exist before the first toast and only gain a child
// per message. The visible toasts carry no live role of their own, which
// keeps every message to a single announcement. The regions use `aria-live`
// without `role="alert"`/`"status"` so they do not turn up as extra alerts
// next to real ones (RouteError, form errors).
const isUrgent = (type: ToastItem['type']) => type === 'error' || type === 'warning'

export default function Toast() {
  const { t } = useTranslation()
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)
  const pauseToast = useToastStore((s) => s.pauseToast)
  const resumeToast = useToastStore((s) => s.resumeToast)
  const containerRef = useRef<HTMLDivElement>(null)
  // Where focus was before it entered a toast: the place to go back to when the
  // last toast is closed from the keyboard.
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const insideContainer = (node: EventTarget | null) => node instanceof Node && !!containerRef.current?.contains(node)

  const rememberFocusOrigin = (e: FocusEvent) => {
    if (!insideContainer(e.relatedTarget) && e.relatedTarget instanceof HTMLElement) {
      returnFocusRef.current = e.relatedTarget
    }
  }

  // Closing a toast that holds focus would drop focus on <body>. It goes to the
  // next toast (else the previous one), and when none is left back to where it came from.
  const closeToast = (e: MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation()
    const card = e.currentTarget.closest('.toast')
    const hadFocus = !!card?.contains(document.activeElement)
    const neighbour = (card?.nextElementSibling ?? card?.previousElementSibling)?.querySelector<HTMLElement>('.toast-close')
    removeToast(id)
    if (!hadFocus) return
    const origin = returnFocusRef.current
    if (neighbour) neighbour.focus()
    else if (origin?.isConnected) origin.focus()
  }

  // `aria-atomic="false"` and `aria-relevant="additions"`: a new message is read
  // alone, earlier ones are not repeated, and removing a toast says nothing.
  const announcements = (urgent: boolean) =>
    toasts.filter((toast) => isUrgent(toast.type) === urgent).map((toast) => <p key={toast.id}>{toast.message}</p>)

  return createPortal(
    <>
      <div className="toast-container" ref={containerRef}>
        {toasts.map((toast) => (
          // Clicking anywhere on the toast closes it: a mouse shortcut. The keyboard
          // and screen-reader way to the same action is the close button below.
          // While the pointer is over a toast or focus is inside it, its timer stands still.
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- mouse shortcut for the close button
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
            onClick={() => removeToast(toast.id)}
            onMouseEnter={() => pauseToast(toast.id)}
            onMouseLeave={(e) => {
              if (!e.currentTarget.contains(document.activeElement)) resumeToast(toast.id)
            }}
            onFocus={(e) => {
              rememberFocusOrigin(e)
              pauseToast(toast.id)
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) resumeToast(toast.id)
            }}
          >
            <div className="toast-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d={ICON_PATHS[toast.type] ?? ICON_PATHS.info} clipRule="evenodd" />
              </svg>
            </div>
            <div className="toast-content">
              <p className="toast-message">{toast.message}</p>
            </div>
            <button
              type="button"
              className="toast-close"
              aria-label={t('toast.close')}
              onClick={(e) => closeToast(e, toast.id)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d={CLOSE_PATH} clipRule="evenodd" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <div aria-live="polite" aria-atomic="false" aria-relevant="additions" data-testid="toast-live-polite" className="sr-only">
        {announcements(false)}
      </div>
      <div aria-live="assertive" aria-atomic="false" aria-relevant="additions" data-testid="toast-live-assertive" className="sr-only">
        {announcements(true)}
      </div>
    </>,
    document.body,
  )
}
