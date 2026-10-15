import { useEffect, useState } from 'react'
import { userApi } from '@/api/user.api'
import type { User } from '@/types'

const DEFAULT_LIST_LIMIT = 100
const SEARCH_RESULT_LIMIT = 10
const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 300

interface SearchResult {
  key: string
  users: User[]
}

/**
 * Debounced user lookup for the "add members" picker.
 *
 * An empty query lists the default students; a query of at least two characters
 * is searched after a short debounce; a single character does nothing.
 * ``session`` changes every time the picker is opened so the default list is
 * reloaded. Loading is derived ("the latest result is not for the current
 * request yet"), so no state is set synchronously inside the effect.
 */
export function useUserSearch(active: boolean, session: number, onListError?: () => void) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SearchResult>({ key: '', users: [] })

  const trimmed = query.trim()
  const requestKey = `${session}:${trimmed}`
  const isRequest = active && (trimmed.length === 0 || trimmed.length >= MIN_QUERY_LENGTH)

  useEffect(() => {
    if (!isRequest) return
    let cancelled = false
    const publish = (users: User[]) => {
      if (!cancelled) setResult({ key: requestKey, users })
    }

    if (trimmed.length === 0) {
      userApi
        .list({ role: 'student', limit: DEFAULT_LIST_LIMIT })
        .then(({ data }) => publish(data))
        .catch(() => {
          publish([])
          if (!cancelled) onListError?.()
        })
      return () => {
        cancelled = true
      }
    }

    const timer = window.setTimeout(() => {
      userApi
        .search(trimmed, SEARCH_RESULT_LIMIT)
        .then(({ data }) => publish(data))
        .catch(() => publish([]))
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // onListError is intentionally excluded: it only reports, it must not retrigger a load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRequest, requestKey, trimmed])

  const isSearching = isRequest && result.key !== requestKey

  return { query, setQuery, users: result.users, isSearching }
}
