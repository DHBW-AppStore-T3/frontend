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
import type { Task, DeploymentResource, PodWorkload } from '@/types'
import {
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
  // Pods (Linux apps) or OpenStack VMs (the Windows desktop).
  const isPods = deployment?.runtime === 'kubernetes'

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deploymentId])

  // Members (the owner included, when in a team) get their own access from
  // `/my-access` — the only place credentials come from.
  const loadMyAccess = useCallback(async () => {
    if (!permissionsOf(useDeploymentStore.getState().currentDeployment).member) return
    try {
      const { data } = await deploymentApi.getMyAccess(deploymentId)
      setMyAccounts((data.user_accounts ?? null) as UserAccountMap | null)
      setMyTeamVms((data.team_vms ?? null) as TeamVmMap | null)
    } catch (err) {
      console.error('Error loading own access credentials:', err)
    }
  }, [deploymentId])

  const teamVms = useMemo(() => teamVmsOf(deployment?.outputs, myTeamVms), [deployment?.outputs, myTeamVms])
  const ownAccount = useMemo(() => ownAccountOf(myAccounts), [myAccounts])
  const enrichedTeams = useMemo(
    () => enrichTeams(deployment?.teams, teamVms, authUserId, ownAccount),
    [deployment?.teams, teamVms, authUserId, ownAccount],
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
  const [resources, setResources] = useState<DeploymentResource[]>([])
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [resourcesError, setResourcesError] = useState<string | null>(null)
  // Pod deployments: their workloads, read live from the cluster.
  const [workloads, setWorkloads] = useState<PodWorkload[]>([])
  const [workloadsLive, setWorkloadsLive] = useState(true)
  const [workloadBusy, setWorkloadBusy] = useState<Set<string>>(new Set())
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
        setWorkloads(response.data.workloads ?? [])
        setWorkloadsLive(response.data.live)
      } catch (err: any) {
        const status = err?.response?.status
        const reason = errorReason(err)
        if (reason && te(`errors.${reason}`)) setResourcesError(localizedError(err, t, te))
        else if (status === 412 || status === 403) setResourcesError(t('vm.resourcesErrors.missingCredentials'))
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
        .listResources(deploymentId, { refresh: true })
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
      // A finished redeploy produced a new TF state: clear the in-flight set
      // and reload the resource list.
      setRedeployInFlight(new Set())
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
      toasts.addToast({ type: 'error', message: t('DeploymentDetailView.taskDetailError') })
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
      toasts.success(t('DeploymentDetailView.redeployStarted', { address }))
      // Refresh tasks right away so the new REDEPLOY row becomes the active
      // task → the SSE stream attaches and live progress renders.
      await loadTasks()
    } catch (err: any) {
      setRedeployInFlight((s) => {
        const next = new Set(s)
        next.delete(address)
        return next
      })
      if (err?.response?.status === 409 && !errorReason(err)) {
        toasts.error(t('DeploymentDetailView.lifecycleBusy'))
      } else {
        toasts.error(localizedError(err, t, te, t('DeploymentDetailView.redeployFailed')))
      }
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
    isPods,

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

    // infrastructure (VM apps) and workloads (pods)
    workloads,
    workloadsLive,
    workloadBusy,
    showResetModal,
    setShowResetModal,
    resetTargetWorkload,
    restartWorkload: (workload: string) => void workloadAction(workload, false),
    askResetWorkload,
    confirmResetWorkload,
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
    showRedeployModal,
    setShowRedeployModal,
    redeployTargetAddress,
    showPauseResumeModal,
    setShowPauseResumeModal,
    confirmCancel,
    confirmDelete,
    confirmRedeploy,
    confirmPauseResume,

  }
}
