import { useCallback, useState } from 'react'

const storageKey = (accountId: string | null) => `appstore.favorites.${accountId ?? 'guest'}`

function read(accountId: string | null): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey(accountId)) ?? '[]')
    return Array.isArray(stored)
      ? stored.filter((id): id is string => typeof id === 'string')
      : []
  } catch {
    return []
  }
}

/** Per-account browser preferences; blocked storage falls back to this session. */
export function useFavorites(accountId: string | null) {
  const [state, setState] = useState(() => ({ accountId, favorites: read(accountId) }))

  // Re-read when the account changes (render-phase update, no effect needed).
  let current = state
  if (state.accountId !== accountId) {
    current = { accountId, favorites: read(accountId) }
    setState(current)
  }

  const toggleFavorite = useCallback(
    (id: string) => {
      setState((prev) => {
        const favorites = prev.favorites.includes(id)
          ? prev.favorites.filter((value) => value !== id)
          : [...prev.favorites, id]
        try {
          localStorage.setItem(storageKey(prev.accountId), JSON.stringify(favorites))
        } catch {
          /* Session-only in restricted embeds. */
        }
        return { ...prev, favorites }
      })
    },
    [],
  )

  return { favorites: current.favorites, toggleFavorite }
}
