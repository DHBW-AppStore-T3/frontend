import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Copy-to-clipboard with per-button feedback. Each button tags its copy with a
 * unique key; the key of whichever was last copied is exposed for ~1.5s so its
 * icon can flip to a check.
 */
export function useClipboard(resetMs = 1500) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  const copy = useCallback(
    async (text: string, key: string) => {
      if (!text) return
      try {
        // ``navigator.clipboard`` needs a secure context (https/localhost).
        // Falls back to ``execCommand('copy')`` so it still works over plain http.
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text)
        } else {
          const ta = document.createElement('textarea')
          ta.value = text
          ta.style.position = 'fixed'
          ta.style.opacity = '0'
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          document.body.removeChild(ta)
        }
        setCopiedKey(key)
        if (timer.current !== null) window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => {
          setCopiedKey(null)
          timer.current = null
        }, resetMs)
      } catch (err) {
        console.error('Copy failed:', err)
      }
    },
    [resetMs],
  )

  return { copiedKey, copy }
}
