import { useCallback, useEffect, useRef, useState } from 'react'
import { appApi } from '@/api/app.api'
import type { App, AppVersionApproval } from '@/types'

type CountMap = Record<string, number>

interface Options {
  onLoadError?: () => void
}

function countByApp(items: { appId: string }[]): CountMap {
  const counts: CountMap = {}
  for (const { appId } of items) counts[appId] = (counts[appId] ?? 0) + 1
  return counts
}

function updateVersion(
  list: AppVersionApproval[],
  versionTag: string,
  patch: Partial<AppVersionApproval>,
): AppVersionApproval[] {
  return list.map((a) => (a.version_tag === versionTag ? { ...a, ...patch } : a))
}

/**
 * Data + actions of the admin approval queue: the app list, the pending queue
 * counts, and the lazily loaded per-app version approvals.
 */
export function useApprovalQueue({ onLoadError }: Options = {}) {
  const [isLoading, setIsLoading] = useState(true)
  const [apps, setApps] = useState<App[]>([])
  const [pendingCount, setPendingCount] = useState<CountMap>({})
  const [submissionCount, setSubmissionCount] = useState<CountMap>({})
  const [approvals, setApprovals] = useState<Record<string, AppVersionApproval[]>>({})
  const [loadingApprovals, setLoadingApprovals] = useState<Record<string, boolean>>({})
  /** ``"<appId>:<versionTag>"`` of the version with an action in flight. */
  const [actingOn, setActingOn] = useState<string | null>(null)

  // Approvals already requested; guards against double loads without re-renders.
  const requested = useRef(new Set<string>())
  const onLoadErrorRef = useRef(onLoadError)
  useEffect(() => {
    onLoadErrorRef.current = onLoadError
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [appsRes, pendingRes] = await Promise.all([appApi.list(), appApi.admin.listPendingApprovals()])
        if (cancelled) return
        setApps(appsRes.data)
        const counts = countByApp(pendingRes.data)
        setPendingCount(counts)
        setSubmissionCount(counts)
      } catch {
        if (!cancelled) onLoadErrorRef.current?.()
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loadApprovals = useCallback(async (appId: string) => {
    if (requested.current.has(appId)) return
    requested.current.add(appId)
    setLoadingApprovals((m) => ({ ...m, [appId]: true }))
    try {
      const { data } = await appApi.listVersionApprovals(appId)
      setApprovals((m) => ({ ...m, [appId]: data }))
      // Now that the full picture is known, correct the counts.
      setSubmissionCount((m) => ({ ...m, [appId]: data.length }))
      setPendingCount((m) => ({ ...m, [appId]: data.filter((a) => a.status === 'pending').length }))
    } catch {
      setApprovals((m) => ({ ...m, [appId]: [] }))
    } finally {
      setLoadingApprovals((m) => ({ ...m, [appId]: false }))
    }
  }, [])

  const patchVersion = (appId: string, versionTag: string, patch: Partial<AppVersionApproval>) =>
    setApprovals((m) => (m[appId] ? { ...m, [appId]: updateVersion(m[appId], versionTag, patch) } : m))

  const decrementPending = (appId: string) =>
    setPendingCount((m) => (m[appId] ? { ...m, [appId]: Math.max(0, m[appId] - 1) } : m))

  /** Runs one admin action on a version; resolves ``true`` on success. */
  const act = async (appId: string, versionTag: string, run: () => Promise<unknown>, onDone: () => void) => {
    setActingOn(`${appId}:${versionTag}`)
    try {
      await run()
      onDone()
      return true
    } catch {
      return false
    } finally {
      setActingOn(null)
    }
  }

  const approve = (appId: string, versionTag: string) =>
    act(
      appId,
      versionTag,
      () => appApi.admin.approveVersion(appId, versionTag),
      () => {
        patchVersion(appId, versionTag, { status: 'approved' })
        decrementPending(appId)
      },
    )

  const rejectWith =
    (call: typeof appApi.admin.rejectVersion, countsAsPending: boolean) =>
    async (appId: string, versionTag: string, rawReason: string) => {
      const reason = rawReason.trim()
      if (!reason) return false
      return act(
        appId,
        versionTag,
        () => call(appId, versionTag, reason),
        () => {
          patchVersion(appId, versionTag, { status: 'rejected', rejection_reason: reason })
          if (countsAsPending) decrementPending(appId)
        },
      )
    }

  return {
    isLoading,
    apps,
    pendingCount,
    submissionCount,
    approvals,
    loadingApprovals,
    actingOn,
    loadApprovals,
    approve,
    reject: rejectWith(appApi.admin.rejectVersion, true),
    revoke: rejectWith(appApi.admin.revokeVersion, false),
  }
}
