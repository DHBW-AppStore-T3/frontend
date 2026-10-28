/**
 * State, data loading and actions of the deployment detail page.
 *
 * Extracted from the view so the (large) presentation stays declarative. It
 * owns: the deployment + task data, the member-self-access fallback, the
 * infrastructure resource list, the live-stream wiring (seeding from the DB
 * task, start/stop on relevance changes, post-stream refresh) and every
 * lifecycle action (cancel, delete, pause/resume, redeploy).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import { taskApi } from '@/api/task.api'
import { deploymentApi } from '@/api/deployment.api'
import { useDeploymentStream } from '@/composables/useDeploymentStream'
import { useDeploymentPhases, DEFAULT_PHASE_COUNT } from '@/composables/useDeploymentPhases'
import { extractErrorMessage, errorReason, localizedError } from '@/utils/http-error'
import { paths } from '@/router/paths'
import type { Task, PodWorkload } from '@/types'
import {
  type AccountHit,
  type UserAccountMap,
  type TeamVmMap,
  teamVmsOf,
  ownAccountOf,
  enrichTeams,
  logEntryCount,
  splitTaskLogs,
  parseGroups,
  parseVariables,
  pickActiveTask,
  sortByCreatedDesc,
  isLiveStatus,
} from './helpers'
import { permissionsOf, lifecycleGates } from './access'
import { useDeploymentStatusPolling, shouldPollDeploymentStatus } from './useDeploymentStatusPolling'
import { isClusterRuntime } from '@/utils/runtime'

export function useDeploymentDetail(deploymentId: string) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const deployment = useDeploymentStore((s) => s.currentDeployment)
  const authUserId = useAuthStore((s) => s.user?.userId)

  const [tasks, setTasks] = useState<Task[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [loadingTaskDetail, setLoadingTaskDetail] = useState(false)
  // The caller's OWN access, from `/my-access` (members only): exactly their
  // account entry, never a teammate's (.github#7 H), plus their team's block.
  const [myAccounts, setMyAccounts] = useState<UserAccountMap | null>(null)
  const [myTeamVms, setMyTeamVms] = useState<TeamVmMap | null>(null)

  // What the caller may see and do comes from the API, not from the role.
  const permissions = permissionsOf(deployment)
  const isOwnerView = permissions.owner_view
  const gates = lifecycleGates(deployment)
  // Pods (Linux apps) or KubeVirt VMs (the Windows desktop).
  const isCluster = isClusterRuntime(deployment?.runtime)

  // Imperative (non-render) read, so async flows decide on fresh data.
  const isOwnerViewNow = () =>
    permissionsOf(useDeploymentStore.getState().currentDeployment).owner_view

  const te = (key: string) => i18n.exists(key)

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
  }, [deploymentId])

  // Members (the owner included, when in a team) get their own access from
  // `/my-access` — the only place credentials come from.
  const loadMyAccess = useCallback(async () => {
    if (!permissionsOf(useDeploymentStore.getState().currentDeployment).member) return
    try {
      const { data } = await deploymentApi.getMyAccess(deploymentId)
      setMyAccounts((data.user_accounts ?? null) as UserAccountMap | null)
      setMyTeamVms(((data as { team_endpoints?: unknown }).team_endpoints ?? data.team_vms ?? null) as TeamVmMap | null)
    } catch (err) {
      console.error('Error loading own access credentials:', err)
    }
  }, [deploymentId])

  const teamVms = useMemo(() => teamVmsOf(deployment?.outputs, myTeamVms), [deployment?.outputs, myTeamVms])
  const ownAccount = useMemo(() => ownAccountOf(myAccounts), [myAccounts])

  // One member's credentials, on request (operate right: the deploying
  // teacher, an admin). Returned to the caller, never kept here.
  const revealMemberAccess = useCallback(
    async (userId: string): Promise<AccountHit | null> => {
      const { data } = await deploymentApi.getMemberAccess(deploymentId, userId)
      return ownAccountOf((data.user_accounts ?? null) as UserAccountMap | null)
    },
    [deploymentId],
  )
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

  // True while the deployment (or its active task) is still moving.
  const isDeploymentBusy =
    isLiveStatus(deployment?.status) ||
    isLiveStatus(activeTask?.status) ||
    // Members never load tasks, but a redeploy/pause/resume can be in flight
    // while the row reads "success": fall back to the detail's latest_task.
    isLiveStatus(deployment?.latest_task?.status)

  // --------------------------------------------------------- infrastructure
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [resourcesError, setResourcesError] = useState<string | null>(null)
  // Pod deployments: their workloads, read live from the cluster.
  const [workloads, setWorkloads] = useState<PodWorkload[]>([])
  const [workloadsLive, setWorkloadsLive] = useState(true)
  const [workloadBusy, setWorkloadBusy] = useState<Set<string>>(new Set())

  // The workload list also tells whose workload carries which link (scope: user).
  const enrichedTeams = useMemo(
    () => enrichTeams(deployment?.teams, teamVms, authUserId, ownAccount, workloads),
    [deployment?.teams, teamVms, authUserId, ownAccount, workloads],
  )

  const loadResources = useCallback(
    async () => {
      if (!isOwnerViewNow()) return
      setResourcesLoading(true)
      setResourcesError(null)
      try {
        const response = await deploymentApi.listResources(deploymentId)
        setWorkloads(response.data.workloads ?? [])
        setWorkloadsLive(response.data.live)
      } catch (err) {
        const e = err as { response?: { status?: number }; message?: string } | null | undefined
        const status = e?.response?.status
        const reason = errorReason(err)
        if (reason && te(`errors.${reason}`)) setResourcesError(localizedError(err, t, te))
        else if (status === 404) {
          // Soft-deleted upstream (e.g. right after a destroy): the workloads
          // are gone; the stream watcher handles the ``gone`` path.
          setWorkloads([])
        } else setResourcesError(e?.message || t('pods.loadFailed'))
      } finally {
        setResourcesLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deploymentId, t],
  )

  // ------------------------------------------------------------ modal state
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPauseResumeModal, setShowPauseResumeModal] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [pauseResumeBusy, setPauseResumeBusy] = useState(false)

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

  // While a pod is still starting or an app sets itself up, ask the cluster again so
  // the status and the setup bar move; a stopped workload does not change by itself.
  const workloadsChanging = workloads.some((w) => w.phase !== 'Stopped' && (!w.ready || !!w.setup))
  useEffect(() => {
    if (!workloadsChanging) return
    const id = setInterval(() => {
      void deploymentApi
        .listResources(deploymentId)
        .then((response) => {
          setWorkloads(response.data.workloads ?? [])
          setWorkloadsLive(response.data.live)
        })
        .catch(() => {
          // The next tick tries again; the visible error belongs to the explicit refresh.
        })
    }, 10_000)
    return () => clearInterval(id)
  }, [workloadsChanging, deploymentId])

  // ---------------------------------------------------------- status polling
  // Students never get the stream (raw worker logs, owner-only), so their
  // status badge is kept fresh by polling the detail while the deployment is live.
  const pollingEnabled = shouldPollDeploymentStatus(deployment)
  const { pollingState: statusPollingState } = useDeploymentStatusPolling({
    deploymentId,
    enabled: pollingEnabled,
    onGone: () => {
      toasts.info(t('DeploymentDetailView.statusGoneToast'))
      navigate(paths.deployments)
    },
  })

  // Credentials only come from `/my-access`: once the deployment settled, fetch them.
  const wasPolling = useRef(false)
  useEffect(() => {
    const was = wasPolling.current
    wasPolling.current = pollingEnabled
    if (was && !pollingEnabled) void loadMyAccess()
  }, [pollingEnabled, loadMyAccess])

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
      void loadMyAccess()
      // A finished restart or reset changed the workloads: reload them.
      void loadResources()
    }
  }, [isStreamRelevant, startStream, stopStream, loadTasks, loadMyAccess, loadResources])

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
          store.error ? t('DeploymentDetailView.noAccess') : t('DeploymentDetailView.notFound'),
        )
        navigate(paths.deployments)
        return
      }

      await loadTasks() // history
      if (cancelled) return

      await loadMyAccess()

      // Separate roundtrip (asks the cluster): don't block the page.
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
      toasts.addToast({ type: 'error', message: t('DeploymentDetailView.taskDetailError') })
    } finally {
      setLoadingTaskDetail(false)
    }
  }
  const deselectTask = () => setSelectedTask(null)

  // Cancel revokes the worker task and runs a destroy that also cleans up
  // everything the deployment created; the 202 response flows into the existing SSE plumbing.
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
        message: localizedError(err, t, te, t('DeploymentDetailView.stopFailedToast')),
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
    } catch (err) {
      toasts.addToast({
        type: 'error',
        message: `${t('DeploymentDetailView.deleteErrorToast')}: ` + extractErrorMessage(err),
      })
    } finally {
      setShowDeleteModal(false)
    }
  }

  // Pod workloads: restart (a new pod, its data stays) or reset (its volume is
  // deleted, so it asks first, in its own modal).
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetTargetWorkload, setResetTargetWorkload] = useState<string | null>(null)

  const workloadAction = async (workload: string, reset: boolean) => {
    if (workloadBusy.has(workload)) return
    setWorkloadBusy((busy) => new Set(busy).add(workload))
    try {
      if (reset) await deploymentApi.resetWorkload(deploymentId, workload)
      else await deploymentApi.restartWorkload(deploymentId, workload)
      toasts.success(t(reset ? 'pods.resetStarted' : 'pods.restartStarted', { workload }))
      await useDeploymentStore.getState().fetchDeploymentById(deploymentId)
      await loadTasks()
    } catch (err) {
      if ((err as { response?: { status?: number } })?.response?.status === 409 && !errorReason(err)) {
        toasts.error(t('DeploymentDetailView.lifecycleBusy'))
      } else {
        toasts.error(localizedError(err, t, te, t('DeploymentDetailView.redeployFailed')))
      }
    } finally {
      setWorkloadBusy((busy) => {
        const next = new Set(busy)
        next.delete(workload)
        return next
      })
    }
  }

  const askResetWorkload = (workload: string) => {
    setResetTargetWorkload(workload)
    setShowResetModal(true)
  }

  const confirmResetWorkload = async () => {
    const workload = resetTargetWorkload
    setShowResetModal(false)
    setResetTargetWorkload(null)
    if (workload) await workloadAction(workload, true)
  }

  // Same wiring as delete: 202 → reload deployment + tasks and let the
  // SSE/activeTask plumbing take over. ``pauseResumeBusy`` debounces the call.
  const confirmPauseResume = async () => {
    if (!deploymentId || pauseResumeBusy) return
    const action = gates.pauseResumeAction
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
    } catch (err) {
      toasts.addToast({
        type: 'error',
        message:
          (action === 'pause'
            ? t('DeploymentDetailView.pauseErrorToast')
            : t('DeploymentDetailView.resumeErrorToast')) +
          ': ' +
          localizedError(err, t, te),
      })
    } finally {
      setPauseResumeBusy(false)
      setShowPauseResumeModal(false)
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
    isStreamRelevant,
    isDeploymentBusy,
    taskLogsSplit,
    logCount,

    // access and runtime
    permissions,
    isCluster,

    // derived deployment data
    groups,
    currentGroup,
    selectGroup: setSelectedGroup,
    deselectGroup: () => setSelectedGroup(null),
    deploymentVariables,
    enrichedTeams,
    revealMemberAccess,

    // status polling (members)
    statusPollingState,

    // stream
    streamProgress,
    streamCurrentPhase,
    streamCurrentPhaseIndex,
    streamConnectionState: connectionState,
    streamLiveLogs: stream.liveLogs,
    streamTotalLogCount: stream.totalLogCount,
    ...phases,

    // workloads
    workloads,
    workloadsLive,
    workloadBusy,
    showResetModal,
    setShowResetModal,
    resetTargetWorkload,
    restartWorkload: (workload: string) => void workloadAction(workload, false),
    askResetWorkload,
    confirmResetWorkload,
    resourcesLoading,
    resourcesError,
    loadResources,

    // lifecycle
    canCancel: gates.canCancel,
    canDelete: gates.canDelete,
    canRedeploy: gates.canRedeploy,
    deleteDisabledReason: gates.canDelete ? '' : t('DeploymentDetailView.deleteUnavailable'),
    canPauseOrResume: gates.canPauseOrResume,
    pauseResumeAction: gates.pauseResumeAction,
    cancelBusy,
    pauseResumeBusy,
    showCancelModal,
    setShowCancelModal,
    showDeleteModal,
    setShowDeleteModal,
    showPauseResumeModal,
    setShowPauseResumeModal,
    confirmCancel,
    confirmDelete,
    confirmPauseResume,

  }
}
