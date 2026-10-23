import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Shared overlay primitive: backdrop-adjacent open/close plumbing used by both
 * Modal and Drawer — focus trap, Escape-to-close, scroll-lock, and returning
 * focus to whatever triggered the overlay once it closes.
 *
 * Attach the returned `containerRef` to the overlay's panel element.
 */
export function useOverlay<T extends HTMLElement = HTMLDivElement>(options: {
  show: boolean
  onClose: () => void
}): {
  containerRef: RefObject<T | null>
} {
  const { show, onClose } = options
  const containerRef = useRef<T | null>(null)

  // Always call the latest handler without re-running the open/close effect.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!show) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }
      const container = containerRef.current
      if (event.key === 'Tab' && container) {
        const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        if (focusable.length === 0) return
        const first = focusable[0]!
        const last = focusable[focusable.length - 1]!
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeydown)
    containerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus()

    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeydown)
      previouslyFocused?.focus()
    }
  }, [show])

  return { containerRef }
}
