import { ref, watch, onBeforeUnmount, nextTick, type Ref } from 'vue'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Shared overlay primitive: backdrop-adjacent open/close plumbing used by both
 * Modal and Drawer — focus trap, Escape-to-close, scroll-lock, and returning
 * focus to whatever triggered the overlay once it closes.
 */
export function useOverlay(options: { show: Ref<boolean>; onClose: () => void }): {
  containerRef: Ref<HTMLElement | null>
} {
  const containerRef = ref<HTMLElement | null>(null)
  let previouslyFocused: HTMLElement | null = null
  let locked = false

  function lockScroll() {
    if (locked) return
    locked = true
    document.body.style.overflow = 'hidden'
  }

  function unlockScroll() {
    if (!locked) return
    locked = false
    document.body.style.overflow = ''
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      options.onClose()
      return
    }
    if (event.key === 'Tab' && containerRef.value) {
      const focusable = Array.from(containerRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
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

  function open() {
    previouslyFocused = document.activeElement as HTMLElement | null
    lockScroll()
    document.addEventListener('keydown', handleKeydown)
    void nextTick(() => {
      const focusable = containerRef.value?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      focusable?.focus()
    })
  }

  function close() {
    unlockScroll()
    document.removeEventListener('keydown', handleKeydown)
    previouslyFocused?.focus()
    previouslyFocused = null
  }

  watch(
    options.show,
    (isShown) => {
      if (isShown) open()
      else close()
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    if (options.show.value) close()
  })

  return { containerRef }
}
