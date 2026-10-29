/**
 * Keeps the page in step with the live stream (issue 146):
 * - attaches / detaches the stream when the active task becomes (ir)relevant and
 *   refreshes tasks, own access and workloads once it is over;
 * - when the stream ends (terminal lifecycle event), reloads deployment + tasks so
 *   the view switches from live progress to the static render, and tells the user how a
 *   destroy / pause / resume ended (a successful destroy auto-soft-deletes the row,
 *   detected by the refetch returning no matching deployment);
 * - while the stream is live, an invalid event reloads deployment + tasks over REST,
 *   at most once per RESYNC_MIN_INTERVAL_MS. The stream is owner-only, and `loadTasks`
 *   skips members, so no owner endpoint is called for them.
 */
import { useEffect, useEffectEvent, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToastStore } from '@/stores/toast.store'
import { paths } from '@/router/paths'
import type { Task } from '@/types'
import type { useDeploymentStream } from '@/composables/useDeploymentStream'
import { sortByCreatedDesc } from './helpers'

/** Minimum gap between two REST resyncs triggered by invalid SSE events. */
const RESYNC_MIN_INTERVAL_MS = 15_000

interface Options {
  deploymentId: string
  stream: ReturnType<typeof useDeploymentStream>
  isStreamRelevant: boolean
  activeTask: Task | null
  loadTasks: () => Promise<Task[]>
  loadMyAccess: () => Promise<void>
  loadResources: () => Promise<void>
}

export function useDeploymentStreamSync({
  deploymentId,
  stream,
  isStreamRelevant,
  activeTask,
  loadTasks,
  loadMyAccess,
  loadResources,
}: Options) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { start: startStream, stop: stopStream, connectionState, invalidEvents } = stream

  // ------------------------------------------------- attach / detach
  const prevRelevant = useRef<boolean | undefined>(undefined)
  useEffect(() => {
    const was = prevRelevant.current
    prevRelevant.current = isStreamRelevant
    if (isStreamRelevant && !was) {
      startStream()
    } else if (!isStreamRelevant && was) {
      stopStream()
      // Refresh the task list once on completion so final logs/outputs land.
      void loadTasks()
      void loadMyAccess()
      // A finished restart or reset changed the workloads: reload them.
      void loadResources()
    }
  }, [isStreamRelevant, startStream, stopStream, loadTasks, loadMyAccess, loadResources])

  // ------------------------------------------------- stream ended
  const reloadAfterEnd = useEffectEvent(() => {
    let cancelled = false
    const toasts = useToastStore.getState()

    void (async () => {
      const wasDestroy = activeTask?.type === 'destroy'
      // Snapshot before the refetch so a pause/resume failure toast fires even
      // if the refresh races and clears the live state.
      const lastActiveType = activeTask?.type
      const lastActiveStatus = activeTask?.status

      await useDeploymentStore.getState().fetchDeploymentById(deploymentId)
      const freshTasks = await loadTasks()
      if (cancelled) return

      const current = useDeploymentStore.getState().currentDeployment
      const gone = !current || current.deploymentId !== deploymentId

      if (gone) {
        toasts.addToast({ type: 'success', message: t('DeploymentDetailView.deleteSuccessToast') })
        navigate(paths.deployments)
        return
      }

      // Destroy attempted but the row still exists → it failed; stay for the logs.
      if (wasDestroy) {
        toasts.addToast({ type: 'error', message: t('DeploymentDetailView.deleteFailedAsyncToast') })
        return
      }

      // Pause/Resume failed asynchronously: `activeTask` is no longer set, so
      // look at the newest task, falling back to the pre-refetch snapshot.
      const newest = sortByCreatedDesc(freshTasks)[0]
      const failedKind =
        (newest?.type === 'pause' || newest?.type === 'resume') && newest.status === 'failed'
          ? newest.type
          : null
      const fallbackKind =
        (lastActiveType === 'pause' || lastActiveType === 'resume') && lastActiveStatus === 'failed'
          ? lastActiveType
          : null
      const kind = failedKind || fallbackKind
      if (kind === 'pause') {
        toasts.addToast({ type: 'error', message: t('DeploymentDetailView.pauseFailedAsyncToast') })
      } else if (kind === 'resume') {
        toasts.addToast({ type: 'error', message: t('DeploymentDetailView.resumeFailedAsyncToast') })
      }
    })()

    return () => {
      cancelled = true
    }
  })
  useEffect(() => {
    if (connectionState !== 'ended') return
    return reloadAfterEnd()
  }, [connectionState])

  // ------------------------------------------------- resync on invalid SSE events
  const resync = useRef({
    mounted: true,
    live: false,
    deploymentId,
    handled: invalidEvents,
    lastAt: null as number | null,
    inFlight: false,
  })
  useEffect(() => {
    const r = resync.current
    r.mounted = true
    r.live = isStreamRelevant && connectionState === 'live'
    if (r.deploymentId !== deploymentId) {
      // Another deployment: events counted so far belong to the old one.
      r.deploymentId = deploymentId
      r.handled = invalidEvents
      r.lastAt = null
    }
    return () => {
      r.mounted = false
    }
  })

  const resyncOverRest = useEffectEvent(() => {
    const r = resync.current
    // A new stream starts counting from zero again.
    if (invalidEvents < r.handled) r.handled = invalidEvents
    if (invalidEvents === r.handled) return
    r.handled = invalidEvents
    if (!r.live || r.inFlight) return
    const now = Date.now()
    if (r.lastAt !== null && now - r.lastAt < RESYNC_MIN_INTERVAL_MS) return
    r.lastAt = now
    r.inFlight = true

    // The answer may arrive after the stream ended, the view unmounted or the
    // deployment changed: then it is dropped instead of loading more.
    const stillCurrent = () => r.mounted && r.live && r.deploymentId === deploymentId
    void (async () => {
      try {
        await useDeploymentStore.getState().fetchDeploymentById(deploymentId)
        if (!stillCurrent()) return
        if (useDeploymentStore.getState().currentDeployment?.deploymentId !== deploymentId) return
        await loadTasks()
      } finally {
        r.inFlight = false
      }
    })()
  })
  useEffect(() => {
    resyncOverRest()
  }, [invalidEvents])
}
