/**
 * Status polling for members who are not the owner view (students).
 *
 * The SSE stream carries raw worker logs and is owner-only, so a student's
 * detail page would never leave "running". This asks `GET /deployments/{id}`
 * every 10 s while the deployment is live and writes a changed answer into the
 * store — straight through the API instead of `fetchDeploymentById`, because
 * `runRequest` flips `isLoading`/`error` (the whole view would flash) and
 * swallows the 403/404/network distinction this hook needs.
 *
 * Rounds are chained `setTimeout`s, never `setInterval`, so requests cannot
 * overlap. A hidden tab pauses the loop (and aborts the request in flight);
 * coming back asks immediately.
 */
import { useEffect, useRef, useState } from 'react'
import { deploymentApi } from '@/api/deployment.api'
import { useDeploymentStore } from '@/stores/deployment.store'
import type { DeploymentWithRelations } from '@/types'
import { permissionsOf } from './access'
import { isLiveStatus } from './helpers'

export const STATUS_POLL_INTERVAL_MS = 10_000
export const STATUS_POLL_MAX_DELAY_MS = 20_000

export type StatusPollingState = 'idle' | 'polling' | 'paused' | 'degraded' | 'forbidden'

type Detail = Pick<DeploymentWithRelations, 'permissions' | 'status'> | null | undefined

/** Members who cannot see the stream, while the deployment is still moving. */
export function shouldPollDeploymentStatus(deployment: Detail): boolean {
  const { member, owner_view } = permissionsOf(deployment as DeploymentWithRelations | null)
  return member && !owner_view && isLiveStatus(deployment?.status)
}

const httpStatusOf = (err: unknown) => (err as { response?: { status?: number } })?.response?.status

const isCanceled = (err: unknown) => (err as { code?: string })?.code === 'ERR_CANCELED'

type Outcome = { deploymentId: string; kind: 'none' | 'paused' | 'degraded' | 'forbidden' }

export function useDeploymentStatusPolling({
  deploymentId,
  enabled,
  onGone,
}: {
  deploymentId: string
  enabled: boolean
  onGone: () => void
}): { pollingState: StatusPollingState } {
  // Keyed by id so a state left over from another deployment never shows.
  const [outcome, setOutcome] = useState<Outcome>({ deploymentId, kind: 'none' })

  // Always call the latest callback without restarting the loop when it changes.
  const onGoneRef = useRef(onGone)
  useEffect(() => {
    onGoneRef.current = onGone
  })

  useEffect(() => {
    if (!enabled) return

    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let controller: AbortController | null = null
    let failures = 0

    const report = (kind: Outcome['kind']) => setOutcome({ deploymentId, kind })

    const clearTimer = () => {
      if (timer !== null) clearTimeout(timer)
      timer = null
    }

    const schedule = (delay: number) => {
      clearTimer()
      timer = setTimeout(() => void run(), delay)
    }

    const run = async () => {
      timer = null
      if (stopped || controller || document.hidden) return
      const mine = new AbortController()
      controller = mine
      try {
        const { data } = await deploymentApi.getById(deploymentId, { signal: mine.signal })
        if (stopped || mine.signal.aborted) return
        controller = null
        failures = 0
        report('none')
        // Never write another deployment's data into the open page.
        if (data.deploymentId === deploymentId) {
          const current = useDeploymentStore.getState().currentDeployment
          if (JSON.stringify(current) !== JSON.stringify(data)) {
            useDeploymentStore.setState({ currentDeployment: data })
          }
        }
        if (!isLiveStatus(data.status)) return
        schedule(STATUS_POLL_INTERVAL_MS)
      } catch (err) {
        if (stopped || mine.signal.aborted || isCanceled(err)) return
        controller = null
        const status = httpStatusOf(err)
        if (status === 404) {
          onGoneRef.current()
        } else if (status === 403) {
          report('forbidden')
        } else {
          // Network error, 5xx, an expired token: keep the last status, say so, back off.
          failures += 1
          report('degraded')
          schedule(Math.min(STATUS_POLL_INTERVAL_MS * 2 ** failures, STATUS_POLL_MAX_DELAY_MS))
        }
      }
    }

    const onVisibilityChange = () => {
      if (stopped) return
      if (document.hidden) {
        clearTimer()
        controller?.abort()
        controller = null
        report('paused')
      } else if (!controller) {
        report('none')
        clearTimer()
        void run()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    if (document.hidden) report('paused')
    else schedule(STATUS_POLL_INTERVAL_MS)

    return () => {
      stopped = true
      clearTimer()
      controller?.abort()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [deploymentId, enabled])

  if (!enabled) return { pollingState: 'idle' }
  const kind = outcome.deploymentId === deploymentId ? outcome.kind : 'none'
  return { pollingState: kind === 'none' ? 'polling' : kind }
}
