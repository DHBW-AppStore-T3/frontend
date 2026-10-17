/**
 * State, data loading and actions of the deployment detail page.
 *
 * Extracted from the view so the (large) presentation stays declarative. It
 * owns: the deployment + task data, the member-self-access fallback, the
 * infrastructure resource list, the live-stream wiring (seeding from the DB
 * task, start/stop on relevance changes, post-stream refresh) and every
 * lifecycle action (cancel, delete, pause/resume, redeploy, resend access).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import { useRole } from '@/composables/useRole'
import { taskApi } from '@/api/task.api'
import { deploymentApi } from '@/api/deployment.api'
import { useDeploymentStream } from '@/composables/useDeploymentStream'
import { useDeploymentPhases, DEFAULT_PHASE_COUNT } from '@/composables/useDeploymentPhases'
import { extractErrorMessage } from '@/utils/http-error'
import { paths } from '@/router/paths'
import type { Task, DeploymentResource } from '@/types'
import {
  type UserAccountMap,
  type TeamVmMap,
  extractUserAccounts,
  extractTeamVms,
  enrichTeams,
  countTfResources,
  logEntryCount,
  splitTaskLogs,
  parseGroups,
  parseVariables,
  pickActiveTask,
  sortByCreatedDesc,
  isLiveStatus,
} from './helpers'

// Lifecycle action gating — mirrors backend/app/services/lifecycle.py:
//   * success                 → Delete (dispatches Destroy), Pause
//   * paused                  → Delete (dispatches Destroy), Resume
//   * pause_failed            → Delete, Pause-Retry, Resume
//   * resume_failed           → Delete, Resume-Retry, Pause
//   * failed                  → Delete (Destroy or soft-delete)
//   * cancelled               → Delete (soft-delete)
//   * pending / running / destroying / pausing / resuming → 409, all disabled
export const DELETE_STATUSES = [
  'success',
  'failed',
  'cancelled',
  'paused',
  'pause_failed',
  'resume_failed',
]

// Cancel is the only action offered while a deploy is still in flight.
const CANCEL_STATUSES = ['pending', 'running']

type ResendState = Record<string, 'sending' | 'sent' | 'error'>

export function useDeploymentDetail(deploymentId: string) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const deployment = useDeploymentStore((s) => s.currentDeployment)
  const authUserId = useAuthStore((s) => s.user?.userId)
  const { isStaff } = useRole()

  const [tasks, setTasks] = useState<Task[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [latestTaskOutputs, setLatestTaskOutputs] = useState<Task | null>(null)
  const [loadingTaskDetail, setLoadingTaskDetail] = useState(false)
  // Member self-access: a non-owner can't read the owner-only task outputs, so
  // their own credentials come from the dedicated ``/my-access`` endpoint.
  const [myAccounts, setMyAccounts] = useState<UserAccountMap | null>(null)
  const [myTeamVms, setMyTeamVms] = useState<TeamVmMap | null>(null)

  // Owner-view vs member-view — mirrors backend/app/utils/permissions.py
  // ``is_deployment_owner_view``. Hides affordances that would 403 on click.
  const isOwnerView = isStaff || (!!deployment?.userId && String(deployment.userId) === String(authUserId))

  // Imperative (non-render) reads, so async flows decide on fresh data.
  const isOwnerViewNow = () => {
    const auth = useAuthStore.getState()
    const role = auth.user?.role
    if (role === 'admin' || role === 'teacher') return true
    const ownerId = useDeploymentStore.getState().currentDeployment?.userId
    return !!ownerId && String(ownerId) === String(auth.user?.userId)
  }

  const toasts = useToastStore.getState()

  // ---------------------------------------------------------------- tasks
  const loadTasks = useCallback(async (): Promise<Task[]> => {
    // Members can't read tasks (the owner-only endpoint 403s): skip the call.
    if (!isOwnerViewNow()) {
      setTasks([])
      return []
    }
    setLoadingTasks(true)
    try {
      const { data } = await taskApi.listByDeployment(deploymentId)
      setTasks(data)
      return data
    } catch (err) {
      console.error('Error loading tasks:', err)
      return []
    } finally {
      setLoadingTasks(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deploymentId])

  // Always returns the currently active data task for the UI blocks.
  const activeDataTask = selectedTask || latestTaskOutputs
  const outputs = activeDataTask?.outputs

  const typedUserAccounts = useMemo(() => extractUserAccounts(outputs, myAccounts), [outputs, myAccounts])
  const teamVms = useMemo(() => extractTeamVms(outputs, myTeamVms), [outputs, myTeamVms])
  const enrichedTeams = useMemo(
    () => enrichTeams(deployment?.teams, typedUserAccounts, teamVms),
    [deployment?.teams, typedUserAccounts, teamVms],
  )
  const tfResourcesCount = countTfResources(selectedTask?.tf_state)
  const logCount = logEntryCount(selectedTask?.logs)
  const taskLogsSplit = splitTaskLogs(typeof selectedTask?.logs === 'string' ? selectedTask.logs : null)
  const groups = useMemo(() => parseGroups(deployment?.userInputVar), [deployment?.userInputVar])
  const deploymentVariables = useMemo(
    () => parseVariables(deployment?.userInputVar),
    [deployment?.userInputVar],
  )

  const activeTask = useMemo(() => pickActiveTask(tasks), [tasks])
  const isStreamRelevant = isOwnerView && isLiveStatus(activeTask?.status)
  const historyTasks = useMemo(() => {
    const list = sortByCreatedDesc(tasks)
    if (!activeTask || !isStreamRelevant) return list
    return list.filter((tk) => tk.taskId !== activeTask.taskId)
  }, [tasks, activeTask, isStreamRelevant])

  // True while the deployment (or its active task) is still moving. The
  // resend-access button stays disabled until the run is terminal.
  const isDeploymentBusy =
    isLiveStatus(deployment?.status) ||
    isLiveStatus(activeTask?.status) ||
    // Members never load tasks, but a redeploy/pause/resume can be in flight
    // while the row reads "success": fall back to the detail's latest_task.
    isLiveStatus(deployment?.latest_task?.status)

  // --------------------------------------------------------- infrastructure
  const [resources, setResources] = useState<DeploymentResource[]>([])
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [resourcesError, setResourcesError] = useState<string | null>(null)
  // Addresses waiting on a redeploy task (disables the card button).
  const [redeployInFlight, setRedeployInFlight] = useState<Set<string>>(new Set())
  // Address of the VM whose inline detail panel is open; null = closed.
  const [openDrawerAddress, setOpenDrawerAddress] = useState<string | null>(null)

  const loadResources = useCallback(
    async (refresh = true) => {
      if (!isOwnerViewNow()) return
      setResourcesLoading(true)
      setResourcesError(null)
      try {
        const response = await deploymentApi.listResources(deploymentId, { refresh })
        setResources(response.data.resources)
      } catch (err: any) {
        const status = err?.response?.status
        if (status === 412) setResourcesError(t('vm.resourcesErrors.missingCredentials'))
        else if (status === 502) setResourcesError(t('vm.resourcesErrors.unreachable'))
        else if (status === 404) {
          // Soft-deleted upstream (e.g. right after a destroy): resources are
          // gone; the stream watcher handles the ``gone`` path.
          setResources([])
        } else setResourcesError(err?.message || t('vm.resourcesErrors.generic'))
      } finally {
        setResourcesLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deploymentId, t],
  )

  const vmResources = useMemo(() => resources.filter((r) => r.category === 'instance'), [resources])
  const networkResources = useMemo(
    () =>
      resources.filter(
        (r) => r.category === 'network' || r.category === 'subnet' || r.category === 'floating_ip',
      ),
    [resources],
  )
  const securityResources = useMemo(
    () => resources.filter((r) => r.category === 'security_group'),
    [resources],
  )

  // Accordion semantics — only one VM detail is visible at a time.
  const openVmDrawer = (address: string) =>
    setOpenDrawerAddress((cur) => (cur === address ? null : address))
  const closeVmDrawer = () => setOpenDrawerAddress(null)

  // ------------------------------------------------------------ modal state
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showRedeployModal, setShowRedeployModal] = useState(false)
  const [redeployTargetAddress, setRedeployTargetAddress] = useState<string | null>(null)
  const [showPauseResumeModal, setShowPauseResumeModal] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [pauseResumeBusy, setPauseResumeBusy] = useState(false)

  // -------------------------------------------------------- lifecycle gating
  const status = deployment?.status ?? ''
  const canCancel = isOwnerView && CANCEL_STATUSES.includes(status)
  const canDelete = isOwnerView && DELETE_STATUSES.includes(status)
  const deleteDisabledReason = canDelete
    ? ''
    : `Delete available when status is ${DELETE_STATUSES.join(', ')}`
  const canPause =
    isOwnerView && (status === 'success' || status === 'pause_failed' || status === 'resume_failed')
  const canResume =
    isOwnerView && (status === 'paused' || status === 'pause_failed' || status === 'resume_failed')
  const canPauseOrResume = canPause || canResume
  // Prefer the action matching the steady-state semantic of the status; from a
  // failure state pick the retry that matches what just broke.
  const pauseResumeAction: 'pause' | 'resume' | null =
    status === 'success' || status === 'pause_failed'
      ? 'pause'
      : status === 'paused' || status === 'resume_failed'
        ? 'resume'
        : null

  // ------------------------------------------------------------ live stream
  const stream = useDeploymentStream(deploymentId)
  const { start: startStream, stop: stopStream } = stream

  // Seed progress/stepper from the DB's latest *live* task so the page renders
  // meaningfully between page load and the first SSE event (e.g. when opened
  // mid-deploy). Finished tasks are deliberately not seeded: their persisted
  // 100% would flash before a freshly dispatched destroy reports progress.
  const live = !!activeTask && isLiveStatus(activeTask.status)
  const seededPhase = live && activeTask?.current_phase ? activeTask.current_phase : null
  const seededProgress = live ? (activeTask?.progress_pct ?? null) : null
  const streamProgress = stream.progress ?? seededProgress
  const streamCurrentPhase = stream.currentPhase ?? seededPhase
  let seededIndex: number | null = null
  if (stream.currentPhase === null && seededPhase && activeTask?.progress_pct != null) {
    // Approximate the phase index from the persisted percent, mirroring the
    // worker's own round(idx/total*100) math.
    const total = stream.totalPhases || DEFAULT_PHASE_COUNT
    seededIndex = Math.max(1, Math.min(total, Math.round((activeTask.progress_pct / 100) * total)))
  }
  const streamCurrentPhaseIndex = stream.currentPhaseIndex ?? seededIndex

  const phases = useDeploymentPhases({
    streamTotalPhases: stream.totalPhases,
    streamPhaseNames: stream.phaseNames,
    streamCurrentPhaseIndex,
    streamProgress,
    activeTask,
  })

  // Latest values for the async stream-ended handler (avoids stale closures).
  const latest = useRef({ activeTask })
  useEffect(() => {
    latest.current = { activeTask }
  })

  // Attach/detach the stream when the active task becomes (ir)relevant.
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
      // A finished redeploy produced a new TF state: clear the in-flight set
      // and reload the resource list.
      setRedeployInFlight(new Set())
      void loadResources()
    }
  }, [isStreamRelevant, startStream, stopStream, loadTasks, loadResources])

  // When the SSE stream ends (terminal lifecycle event), reload deployment +
  // tasks so the view switches from live progress to the static render.
  // A successful destroy auto-soft-deletes the row: detected by the refetch
  // returning no (matching) deployment.
  const connectionState = stream.connectionState
  useEffect(() => {
    if (connectionState !== 'ended') return
    let cancelled = false

    void (async () => {
      const { activeTask: before } = latest.current
      const wasDestroy = before?.type === 'destroy'
      // Snapshot before the refetch so a pause/resume failure toast fires even
      // if the refresh races and clears the live state.
      const lastActiveType = before?.type
      const lastActiveStatus = before?.status

      await useDeploymentStore.getState().fetchDeploymentById(deploymentId)
      const freshTasks = await loadTasks()
      if (cancelled) return

      const current = useDeploymentStore.getState().currentDeployment
      const gone = !current || current.deploymentId !== deploymentId

      if (gone) {
        // Soft-deleted upstream — the destroy ran clean.
        toasts.addToast({ type: 'success', message: t('DeploymentDetailView.deleteSuccessToast') })
        navigate(paths.deployments)
        return
      }

      // Destroy attempted but the row still exists → it failed; stay for the logs.
      if (wasDestroy) {
        toasts.addToast({ type: 'error', message: t('DeploymentDetailView.deleteFailedAsyncToast') })
        return
      }

      // Pause/Resume failed asynchronously: ``activeTask`` is no longer set, so
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState])

  // ------------------------------------------------------------ initial load
  useEffect(() => {
    let cancelled = false

    void (async () => {
      await useDeploymentStore.getState().fetchDeploymentById(deploymentId)
      if (cancelled) return

      const store = useDeploymentStore.getState()
      if (!store.currentDeployment) {
        toasts.error(
          store.error ? 'Du hast keinen Zugriff auf dieses Deployment.' : 'Deployment nicht gefunden.',
        )
        navigate(paths.deployments)
        return
      }

      const loaded = await loadTasks() // history
      if (cancelled) return

      if (isOwnerViewNow()) {
        // Owner view: seed the top outputs from the latest task so the page
        // can render the summary before the first SSE event arrives.
        const latestTask = sortByCreatedDesc(loaded)[0]
        if (latestTask) {
          try {
            const { data } = await taskApi.getById(latestTask.taskId)
            if (!cancelled) setLatestTaskOutputs(data)
          } catch (err) {
            console.error('Error seeding top outputs:', err)
          }
        }
      } else {
        // Member view: fetch just this member's own credentials.
        try {
          const { data } = await deploymentApi.getMyAccess(deploymentId)
          if (!cancelled) {
            // The API type marks fields optional; the local UserAccount is
            // stricter but structurally compatible at the point of use.
            setMyAccounts((data.user_accounts ?? null) as UserAccountMap | null)
            setMyTeamVms((data.team_vms ?? null) as TeamVmMap | null)
          }
        } catch (err) {
          console.error('Error loading own access credentials:', err)
        }
      }

      // Separate roundtrip (OpenStack live-fetch ~1s): don't block the page.
      void loadResources()
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deploymentId])

  // ---------------------------------------------------------------- actions
  const selectTask = async (task: Task) => {
    setLoadingTaskDetail(true)
    try {
      const { data } = await taskApi.getById(task.taskId)
      setSelectedTask(data)
    } catch (err) {
      console.error('Error loading task details:', err)
      toasts.addToast({ type: 'error', message: 'Failed to load task details' })
    } finally {
      setLoadingTaskDetail(false)
    }
  }
  const deselectTask = () => setSelectedTask(null)

  // Cancel revokes the worker task and runs a destroy that also reaps the
  // Packer build instance; the 202 response flows into the existing SSE plumbing.
  const confirmCancel = async () => {
    if (!deploymentId || cancelBusy) return
    setCancelBusy(true)
    try {
      await useDeploymentStore.getState().cancelDeployment(deploymentId)
      setShowCancelModal(false)
      toasts.addToast({ type: 'info', message: t('DeploymentDetailView.stopStartedToast') })
      await useDeploymentStore.getState().fetchDeploymentById(deploymentId)
      await loadTasks()
    } catch (err) {
      toasts.addToast({
        type: 'error',
        message: extractErrorMessage(err, t('DeploymentDetailView.stopFailedToast')),
      })
    } finally {
      setCancelBusy(false)
    }
  }

  // The DELETE endpoint returns 202 when it dispatched a destroy task (stay and
  // watch the stream) or 204 when it soft-deleted directly (leave immediately).
  const confirmDelete = async () => {
    if (!deploymentId) return
    try {
      const response = await useDeploymentStore.getState().deleteDeployment(deploymentId)
      if (response?.status === 202) {
        toasts.addToast({ type: 'info', message: t('DeploymentDetailView.deleteStartedToast') })
        await useDeploymentStore.getState().fetchDeploymentById(deploymentId)
        await loadTasks()
      } else {
        toasts.addToast({ type: 'success', message: t('DeploymentDetailView.deleteSuccessToast') })
        navigate(paths.deployments)
      }
    } catch (err: any) {
      toasts.addToast({
        type: 'error',
        message: `${t('DeploymentDetailView.deleteErrorToast')}: ` + extractErrorMessage(err),
      })
    } finally {
      setShowDeleteModal(false)
    }
  }

  // Redeploy is a two-step UX: the card asks for confirmation (Modal), the
  // actual API call lives in ``executeRedeploy``.
  const redeployVm = (address: string) => {
    if (redeployInFlight.has(address)) return
    setRedeployTargetAddress(address)
    setShowRedeployModal(true)
  }

  const executeRedeploy = async (address: string) => {
    setRedeployInFlight((s) => new Set(s).add(address))
    try {
      await deploymentApi.redeployResource(deploymentId, address)
      toasts.success(`Redeploy gestartet für ${address}`)
      // Refresh tasks right away so the new REDEPLOY row becomes the active
      // task → the SSE stream attaches and live progress renders.
      await loadTasks()
    } catch (err: any) {
      setRedeployInFlight((s) => {
        const next = new Set(s)
        next.delete(address)
        return next
      })
      const reason = err?.response?.data?.detail?.reason
      if (reason === 'non_redeployable_resource_type') {
        toasts.error('Nur Compute-Instanzen können einzeln redeployed werden.')
      } else if (reason === 'resource_not_in_state') {
        toasts.error('Diese Resource ist nicht mehr im aktuellen State.')
      } else if (err?.response?.status === 409) {
        toasts.error('Es läuft bereits eine Lifecycle-Aktion für dieses Deployment.')
      } else {
        toasts.error(err?.message || 'Redeploy fehlgeschlagen.')
      }
    }
  }

  // Close the modal first (immediate feedback), then dispatch the call.
  const confirmRedeploy = async () => {
    const address = redeployTargetAddress
    setShowRedeployModal(false)
    if (!address) return
    try {
      await executeRedeploy(address)
    } finally {
      setRedeployTargetAddress(null)
    }
  }

  // Same wiring as delete: 202 → reload deployment + tasks and let the
  // SSE/activeTask plumbing take over. ``pauseResumeBusy`` debounces the call.
  const confirmPauseResume = async () => {
    if (!deploymentId || pauseResumeBusy) return
    const action = pauseResumeAction
    if (!action) return
    setPauseResumeBusy(true)
    try {
      const store = useDeploymentStore.getState()
      await (action === 'pause' ? store.pauseDeployment(deploymentId) : store.resumeDeployment(deploymentId))
      toasts.addToast({
        type: 'info',
        message:
          action === 'pause'
            ? t('DeploymentDetailView.pauseStartedToast')
            : t('DeploymentDetailView.resumeStartedToast'),
      })
      await useDeploymentStore.getState().fetchDeploymentById(deploymentId)
      await loadTasks()
    } catch (err: any) {
      toasts.addToast({
        type: 'error',
        message:
          (action === 'pause'
            ? t('DeploymentDetailView.pauseErrorToast')
            : t('DeploymentDetailView.resumeErrorToast')) +
          ': ' +
          extractErrorMessage(err),
      })
    } finally {
      setPauseResumeBusy(false)
      setShowPauseResumeModal(false)
    }
  }

  // Per-user resend-access state: userId → 'sending' | 'sent' | 'error'.
  const [resendState, setResendState] = useState<ResendState>({})
  const resendTimers = useRef<number[]>([])
  useEffect(() => {
    const timers = resendTimers.current
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [])

  const clearResendLater = (userId: string, ms: number) => {
    resendTimers.current.push(
      window.setTimeout(() => {
        setResendState((s) => {
          const next = { ...s }
          delete next[userId]
          return next
        })
      }, ms),
    )
  }

  const resendAccess = async (teamId: string, userId: string) => {
    setResendState((s) => ({ ...s, [userId]: 'sending' }))
    try {
      await deploymentApi.resendAccess(deploymentId, teamId, userId)
      setResendState((s) => ({ ...s, [userId]: 'sent' }))
      toasts.addToast({ type: 'success', message: t('DeploymentDetailView.resendAccessSuccess') })
      clearResendLater(userId, 2000)
    } catch (err: any) {
      setResendState((s) => ({ ...s, [userId]: 'error' }))
      // Two reasons get a dedicated toast so the user understands WHY the mail
      // didn't go out: smtp_disabled (503, platform kill-switch) and
      // deployment_busy (409). Everything else gets the verbose failure toast.
      const reason = err?.response?.data?.detail?.reason || err?.message || 'unknown'
      const isSmtpDisabled = err?.response?.status === 503 && reason === 'smtp_disabled'
      const isBusy = err?.response?.status === 409 && reason === 'deployment_busy'
      toasts.addToast({
        type: isSmtpDisabled || isBusy ? 'warning' : 'error',
        message: isSmtpDisabled
          ? t('DeploymentDetailView.resendAccessSmtpDisabled')
          : isBusy
            ? t('DeploymentDetailView.resendAccessDeploymentBusy')
            : `${t('DeploymentDetailView.resendAccessError')}: ${reason}`,
      })
      clearResendLater(userId, 3000)
    }
  }

  // Selected group in the Groups card (overview ↔ detail).
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null)
  const currentGroup = selectedGroup === null ? null : (groups[selectedGroup] ?? null)

  return {
    deployment,
    isOwnerView,
    authUserId,

    // tasks
    tasks,
    loadingTasks,
    historyTasks,
    selectedTask,
    loadingTaskDetail,
    selectTask,
    deselectTask,
    activeTask,
    activeDataTask,
    isStreamRelevant,
    isDeploymentBusy,
    taskLogsSplit,
    logCount,
    tfResourcesCount,

    // derived deployment data
    groups,
    currentGroup,
    selectGroup: setSelectedGroup,
    deselectGroup: () => setSelectedGroup(null),
    deploymentVariables,
    enrichedTeams,

    // stream
    streamProgress,
    streamCurrentPhase,
    streamCurrentPhaseIndex,
    streamConnectionState: connectionState,
    streamLiveLogs: stream.liveLogs,
    streamTotalLogCount: stream.totalLogCount,
    ...phases,

    // infrastructure
    vmResources,
    networkResources,
    securityResources,
    resourcesLoading,
    resourcesError,
    redeployInFlight,
    openDrawerAddress,
    loadResources,
    openVmDrawer,
    closeVmDrawer,
    redeployVm,

    // lifecycle
    canCancel,
    canDelete,
    deleteDisabledReason,
    canPauseOrResume,
    pauseResumeAction,
    cancelBusy,
    pauseResumeBusy,
    showCancelModal,
    setShowCancelModal,
    showDeleteModal,
    setShowDeleteModal,
    showRedeployModal,
    setShowRedeployModal,
    redeployTargetAddress,
    showPauseResumeModal,
    setShowPauseResumeModal,
    confirmCancel,
    confirmDelete,
    confirmRedeploy,
    confirmPauseResume,

    // team access
    resendState,
    resendAccess,
  }
}
