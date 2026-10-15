import { useCallback, useEffect, useState, type CSSProperties, type RefObject } from 'react'

const PANEL_MAX_HEIGHT = 384 // Tailwind max-h-96
const GAP = 4
const MIN_HEIGHT = 200
const VIEWPORT_MARGIN = 8
const PANEL_Z_INDEX = 60

/**
 * A dropdown panel anchored to a trigger element and rendered in a portal.
 *
 * ``position: fixed`` placement is derived from the trigger's bounding rect and
 * recalibrated on scroll/resize; it flips upwards when there is not enough room
 * below, and closes when the trigger scrolls out of view. Outside-clicks and
 * Escape close it. Listeners only exist while the panel is open.
 */
export function useFloatingPanel(
  triggerRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
) {
  const [isOpen, setIsOpen] = useState(false)
  const [style, setStyle] = useState<CSSProperties>({})

  const close = useCallback(() => setIsOpen(false), [])

  const reposition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const viewportH = window.innerHeight
    // The trigger scrolled out of the viewport: don't leave the panel hanging.
    if (rect.bottom < 0 || rect.top > viewportH) {
      setIsOpen(false)
      return
    }
    const spaceBelow = viewportH - rect.bottom
    const spaceAbove = rect.top
    const flipUp = spaceBelow < PANEL_MAX_HEIGHT && spaceAbove > spaceBelow
    const base: CSSProperties = {
      position: 'fixed',
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      zIndex: PANEL_Z_INDEX,
    }
    setStyle(
      flipUp
        ? {
            ...base,
            bottom: `${viewportH - rect.top + GAP}px`,
            maxHeight: `${Math.max(spaceAbove - GAP - VIEWPORT_MARGIN, MIN_HEIGHT)}px`,
          }
        : {
            ...base,
            top: `${rect.bottom + GAP}px`,
            maxHeight: `${Math.max(spaceBelow - GAP - VIEWPORT_MARGIN, MIN_HEIGHT)}px`,
          },
    )
  }, [triggerRef])

  const toggle = () => {
    if (isOpen) {
      setIsOpen(false)
      return
    }
    reposition()
    setIsOpen(true)
  }

  useEffect(() => {
    if (!isOpen) return

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setIsOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    // ``capture`` on scroll so scrolling inside overflow containers reacts too.
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, reposition, triggerRef, panelRef])

  return { isOpen, style, toggle, close }
}
