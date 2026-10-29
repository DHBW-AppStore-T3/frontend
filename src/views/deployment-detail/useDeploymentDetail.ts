/**
 * State and wiring of the deployment detail page.
 *
 * Extracted from the view so the (large) presentation stays declarative. It composes
 * the focused hooks of this folder (issue 146): `useDeploymentTasks` (task list and
 * detail), `useOwnAccess` (own credentials), `useDeploymentWorkloads` (pods and their
 * actions), `useDeploymentLifecycle` (cancel, delete, pause/resume) and
 * `useDeploymentStreamSync` (attach, ended reload, resync), and owns what ties them
 * together: the deployment from the store, derived task state, progress seeding for
 * the stepper, status polling and the initial load.
 */
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import { useDeploymentStream } from '@/composables/useDeploymentStream'
import { useDeploymentPhases, DEFAULT_PHASE_COUNT } from '@/composables/useDeploymentPhases'
import { paths } from '@/router/paths'
import {
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
import { useDeploymentTasks } from './useDeploymentTasks'
import { useOwnAccess } from './useOwnAccess'
import { useDeploymentWorkloads } from './useDeploymentWorkloads'
import { useDeploymentLifecycle } from './useDeploymentLifecycle'
import { useDeploymentStreamSync } from './useDeploymentStreamSync'
import { isClusterRuntime } from '@/utils/runtime'

export function useDeploymentDetail(deploymentId: string) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const deployment = useDeploymentStore((s) => s.currentDeployment)
  const authUserId = useAuthStore((s) => s.user?.userId)

  const { tasks, loadingTasks, loadTasks, selectedTask, loadingTaskDetail, selectTask, deselectTask } =
    useDeploymentTasks(deploymentId)
  const { teamVms, ownAccount, loadMyAccess, revealMemberAccess } = useOwnAccess(deploymentId, deployment?.outputs)

  // What the caller may see and do comes from the API, not from the role.
  const permissions = permissionsOf(deployment)
  const isOwnerView = permissions.owner_view
  const gates = lifecycleGates(deployment)
  // Pods (Linux apps) or KubeVirt VMs (the Windows desktop).
  const isCluster = isClusterRuntime(deployment?.runtime)

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
  const workloadState = useDeploymentWorkloads(deploymentId, loadTasks)
  const { workloads, loadResources } = workloadState

  // The workload list also tells whose workload carries which link (scope: user).
  const enrichedTeams = useMemo(
    () => enrichTeams(deployment?.teams, teamVms, authUserId, ownAccount, workloads),
    [deployment?.teams, teamVms, authUserId, ownAccount, workloads],
  )

  const lifecycle = useDeploymentLifecycle(deploymentId, gates, loadTasks)

  // ------------------------------------------------------------ live stream
  const stream = useDeploymentStream(deploymentId)

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

  // ---------------------------------------------------------- status polling
  // Students never get the stream (raw worker logs, owner-only), so their
  // status badge is kept fresh by polling the detail while the deployment is live.
  const pollingEnabled = shouldPollDeploymentStatus(deployment)
  const { pollingState: statusPollingState } = useDeploymentStatusPolling({
    deploymentId,
    enabled: pollingEnabled,
    onGone: () => {
      useToastStore.getState().info(t('DeploymentDetailView.statusGoneToast'))
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

  useDeploymentStreamSync({
    deploymentId,
    stream,
    isStreamRelevant,
    activeTask,
    loadTasks,
    loadMyAccess,
    loadResources,
  })

  // ------------------------------------------------------------ initial load
  const loadOnEntry = useEffectEvent(() => {
    let cancelled = false

    void (async () => {
      await useDeploymentStore.getState().fetchDeploymentById(deploymentId)
      if (cancelled) return

      const store = useDeploymentStore.getState()
      if (!store.currentDeployment) {
        useToastStore
          .getState()
          .error(store.error ? t('DeploymentDetailView.noAccess') : t('DeploymentDetailView.notFound'))
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
  })
  // Once per deployment; everything else is read when the load runs.
  useEffect(() => loadOnEntry(), [deploymentId])

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
    streamConnectionState: stream.connectionState,
    streamLiveLogs: stream.liveLogs,
    streamTotalLogCount: stream.totalLogCount,
    ...phases,

    // workloads
    ...workloadState,

    // lifecycle
    ...lifecycle,
  }
}
