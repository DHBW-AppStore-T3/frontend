import { useEffect, useState, useEffectEvent } from 'react'
import { userApi } from '@/api/user.api'
import { useDeploymentStore } from '@/stores/deployment.store'
import type { User } from '@/types'
import { displayNameOf } from './studentSelection'

const hasIdentity = (u: Partial<User> | undefined): boolean => !!u && !!(u.firstName || u.lastName || u.username || u.email)

/**
 * Resolves display names for student ids. Names come from the wizard's shared
 * student cache (filled by the previous step); ids without usable data are
 * looked up once through the user API.
 */
export function useStudentNames(ids: string[]) {
  const [loaded, setLoaded] = useState<Map<string, User>>(new Map())
  const idsKey = ids.join('|')

  const loadMissing = useEffectEvent(() => {
    const shared = useDeploymentStore.getState().studentCache
    const known = (id: string) => {
      const direct = shared.get(id)
      if (hasIdentity(direct)) return true
      // The cache is keyed by keycloak id; ids may be user ids.
      return [...shared.values()].some((s) => s.userId === id && hasIdentity(s))
    }
    const missing = ids.filter((id) => !known(id))
    if (missing.length === 0) return

    let cancelled = false
    void Promise.all(
      missing.map((id) =>
        userApi
          .getById(id)
          .then((res) => res.data)
          .catch(() => null),
      ),
    ).then((users) => {
      if (cancelled) return
      const next = new Map<string, User>()
      for (const user of users) {
        if (user?.userId) {
          next.set(user.userId, user)
          shared.set(user.userId, user)
        }
      }
      if (next.size > 0) setLoaded((prev) => new Map([...prev, ...next]))
    })
    return () => {
      cancelled = true
    }
  })

  // Runs when the set of ids changes (`idsKey` stands for `ids`).
  useEffect(() => loadMissing(), [idsKey])

  /** Best available label for an id (falls back to the raw id). */
  return (id: string): string => {
    const shared = useDeploymentStore.getState().studentCache
    const user =
      loaded.get(id) ??
      shared.get(id) ??
      [...shared.values()].find((s) => s.userId === id && hasIdentity(s))
    return user && hasIdentity(user) ? displayNameOf(user) : id
  }
}
