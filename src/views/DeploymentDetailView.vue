<script lang="ts" setup>
import { CircleArrowLeft, Loader2, Users, Settings, Terminal, ChevronDown, Trash2, GitBranch, User, Calendar, Clock, Package, AlertCircle, CheckCircle, XCircle, StopCircle, Flame, Copy, Check, PauseCircle, PlayCircle } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import Modal from '@/components/ui/Modal.vue'
import { useRoute, useRouter } from 'vue-router'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { taskApi } from '@/api/task.api'
import { deploymentApi } from '@/api/deployment.api'
import type { Task, DeploymentResource, DeploymentAction, PodWorkload } from '@/types'
import { useDeploymentStream } from '@/composables/useDeploymentStream'
import { useDeploymentPhases, DEFAULT_PHASE_COUNT } from '@/composables/useDeploymentPhases'
import DeploymentInfrastructurePanel from '@/components/DeploymentInfrastructurePanel.vue'
import PodWorkloadsPanel from '@/components/PodWorkloadsPanel.vue'
import InfrastructureVmDrawer from '@/components/InfrastructureVmDrawer.vue'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import { formatDateTime } from '@/utils/format'
import { errorReason, localizedError } from '@/utils/http-error'
import { sshCommandFor, rdpCommandFor, userUrlFor } from '@/utils/connection-commands'
import { highlightJson, prettyJson } from '@/utils/json-view'

import { Eye, EyeOff } from 'lucide-vue-next'

// Password visibility state, keyed by account index/key.
const visiblePasswords = ref<Record<string | number, boolean>>({})

const togglePasswordVisibility = (key: string | number) => {
    visiblePasswords.value[key] = !visiblePasswords.value[key]
}



const route = useRoute()
const router = useRouter()
const deploymentStore = useDeploymentStore()
const authStore = useAuthStore()
const toastStore = useToastStore()
const { t, te } = useI18n()
const tasks = ref<Task[]>([])
const loadingTasks = ref(false)
const selectedTask = ref<Task | null>(null)
// The caller's OWN access, from ``/my-access`` (members only): exactly their
// account entry, never a teammate's (.github#7 H), plus their team's block.
const myAccounts = ref<Record<string, UserAccount> | null>(null)
const myTeamVms = ref<Record<string, TeamVm> | null>(null)
const loadingTaskDetail = ref(false)

const deploymentId = route.params.id as string

const deployment = computed(() => deploymentStore.currentDeployment)
// Pods (Linux apps) or OpenStack VMs (the Windows desktop).
const isPods = computed(() => deployment.value?.runtime === 'kubernetes')

// One account entry as an app publishes it (VM apps: Terraform outputs;
// pods: the platform's own access data).
interface UserAccount {
    username?: string | null
    team?: string
    ip?: string
    port?: number
    auth?: string
    type?: 'password' | 'ssh_key' | 'oauth' | 'none' | string
    authtype?: 'ssh' | 'url' | 'rdp' | string
    url?: string | null
    user_id?: string
    workload?: string
}

interface TeamVm {
    url?: string | null
    floating_ip?: string
    fixed_ip?: string
    workloads?: string[]
}

// What the caller may do, decided by the API (``permissions``/``actions``
// of the detail response) instead of guessed from the role: a teacher is
// not the owner of every deployment any more (.github#7 F).
const permissions = computed(() => deployment.value?.permissions ?? { owner_view: false, operate: false, member: false })
const isOwnerView = computed(() => permissions.value.owner_view)
const allows = (action: DeploymentAction): boolean =>
    permissions.value.operate && (deployment.value?.actions ?? []).includes(action)

// Team-level, non-secret data (URL of a team's app): the owner view reads
// every team's from the redacted outputs, a member their own from my-access.
const teamVms = computed<Record<string, TeamVm>>(() => {
    const raw = deployment.value?.outputs?.raw?.team_vms?.value
    if (raw && typeof raw === 'object') return raw as Record<string, TeamVm>
    return myTeamVms.value ?? {}
})

// The caller's own account: my-access names exactly one, or none.
const myAccount = computed<{ key: string; data: UserAccount } | null>(() => {
    const entries = Object.entries(myAccounts.value ?? {})
    if (entries.length !== 1) return null
    const [key, data] = entries[0]!
    return { key, data }
})

// Only the caller's own row carries credentials. The owner view's outputs
// have every account redacted, and matching accounts to other members by
// name could hand one person another's password (.github#7 H).
const enrichedTeams = computed(() => {
    const currentDeployment = deployment.value
    if (!currentDeployment?.teams) return []
    return currentDeployment.teams.map(team => ({
        ...team,
        vm: teamVms.value[team.name] ?? null,
        members: team.members.map(member => ({
            ...member,
            account: String(member.userId) === String(authStore.userId) ? myAccount.value : null,
        })),
    }))
})

// ----------------------------------------------------------------
// INFRASTRUCTURE TAB — Stage-1 list + Stage-2 drawer + redeploy
// ----------------------------------------------------------------
//
// State for the resource panel sits on the page (not in a Pinia
// store) because it's strictly per-deployment and we want it to
// reset on navigation. The list view polls gently when the latest
// task is idle and refreshes once when a task transitions to
// success/failed; the drawer fetches lazy.

const resources = ref<DeploymentResource[]>([])
const resourcesLoading = ref(false)
const resourcesError = ref<string | null>(null)
// Addresses currently waiting on a redeploy task. Used both to
// disable the button on the card and to know we should refetch the
// list as soon as the task finishes.
const redeployInFlight = ref<Set<string>>(new Set())
// Address of the VM whose detail drawer is currently open. ``null``
// means the drawer is closed; the drawer component lazy-loads on
// mount, so toggling this prop is enough.
const openDrawerAddress = ref<string | null>(null)

// Pod deployments: their workloads, read live from the cluster.
const workloads = ref<PodWorkload[]>([])
const workloadsLive = ref(true)
const workloadBusy = ref<Set<string>>(new Set())

const loadResources = async (refresh = true) => {
    if (!isOwnerView.value) return
    resourcesLoading.value = true
    resourcesError.value = null
    try {
        const response = await deploymentApi.listResources(deploymentId, { refresh })
        resources.value = response.data.resources
        workloads.value = response.data.workloads ?? []
        workloadsLive.value = response.data.live
    } catch (err: any) {
        const status = err?.response?.status
        const reason = errorReason(err)
        if (reason && te(`errors.${reason}`)) {
            resourcesError.value = localizedError(err, t, te)
        } else if (status === 412 || status === 403) {
            resourcesError.value = t('vm.resourcesErrors.missingCredentials')
        } else if (status === 502) {
            resourcesError.value = t('vm.resourcesErrors.unreachable')
        } else if (status === 404) {
            // Deployment was soft-deleted upstream (e.g. right after a
            // successful destroy). The resources are gone; the stream watcher
            // handles the ``gone`` path, so just clear silently here.
            resources.value = []
        } else {
            resourcesError.value = err?.message || t('vm.resourcesErrors.generic')
        }
    } finally {
        resourcesLoading.value = false
    }
}

// Separate compute groups for the three sub-sections.
const vmResources = computed(() => resources.value.filter(r => r.category === 'instance'))
const networkResources = computed(() => resources.value.filter(
    r => r.category === 'network' || r.category === 'subnet' || r.category === 'floating_ip'
))
const securityResources = computed(() => resources.value.filter(r => r.category === 'security_group'))

// Click on the card's "Details" button toggles the inline panel:
// open if a different card is currently shown (or none), close if the
// same card is already expanded. Matches accordion semantics — only
// one VM detail is visible at a time.
const openVmDrawer = (address: string) => {
    if (openDrawerAddress.value === address) {
        openDrawerAddress.value = null
    } else {
        openDrawerAddress.value = address
    }
}
const closeVmDrawer = () => {
    openDrawerAddress.value = null
}

// Redeploy is a two-step UX: the VmCard's "Redeploy" button emits
// ``@redeploy`` with an address, which opens a confirmation Modal
// (same pattern as Delete). The actual API call lives in
// ``executeRedeploy`` so the Modal's confirm button can call it
// without re-doing the address-extraction.
const redeployVm = (address: string) => {
    if (redeployInFlight.value.has(address)) return
    redeployTargetAddress.value = address
    showRedeployModal.value = true
}

const executeRedeploy = async (address: string) => {
    redeployInFlight.value.add(address)
    try {
        await deploymentApi.redeployResource(deploymentId, address)
        toastStore.success(t('DeploymentDetailView.redeployStarted', { address }))
        // Refresh the task list right away so the freshly-dispatched
        // REDEPLOY row shows up as the new ``activeTask``. That in
        // turn flips ``isStreamRelevant`` to true → the SSE stream
        // attaches → live progress + logs render under the page's
        // existing active-task card, identical to deploy/destroy.
        // Without this poll, the new task only becomes visible on
        // the next manual page reload.
        await loadTasks()
    } catch (err: any) {
        redeployInFlight.value.delete(address)
        if (err?.response?.status === 409 && !errorReason(err)) {
            toastStore.error(t('DeploymentDetailView.lifecycleBusy'))
        } else {
            toastStore.error(localizedError(err, t, te, t('DeploymentDetailView.redeployFailed')))
        }
    }
}

// Pod workloads: restart (new pod, data stays) or reset (its volume is
// deleted). Reset asks first, in its own modal.
const showResetModal = ref(false)
const resetTargetWorkload = ref<string | null>(null)

const workloadAction = async (workload: string, reset: boolean) => {
    if (workloadBusy.value.has(workload)) return
    workloadBusy.value = new Set([...workloadBusy.value, workload])
    try {
        if (reset) await deploymentApi.resetWorkload(deploymentId, workload)
        else await deploymentApi.restartWorkload(deploymentId, workload)
        toastStore.success(reset
            ? t('pods.resetStarted', { workload })
            : t('pods.restartStarted', { workload }))
        await deploymentStore.fetchDeploymentById(deploymentId)
        await loadTasks()
    } catch (err: any) {
        if (err?.response?.status === 409 && !errorReason(err)) {
            toastStore.error(t('DeploymentDetailView.lifecycleBusy'))
        } else {
            toastStore.error(localizedError(err, t, te, t('DeploymentDetailView.redeployFailed')))
        }
    } finally {
        const next = new Set(workloadBusy.value)
        next.delete(workload)
        workloadBusy.value = next
    }
}

const askResetWorkload = (workload: string) => {
    resetTargetWorkload.value = workload
    showResetModal.value = true
}

const confirmResetWorkload = async () => {
    const workload = resetTargetWorkload.value
    showResetModal.value = false
    resetTargetWorkload.value = null
    if (workload) await workloadAction(workload, true)
}

// Lifecycle action gating comes from the API: ``permissions.operate`` and
// the ``actions`` the lifecycle matrix allows right now
// (backend/app/services/lifecycle.py). Members never see these buttons.
const canCancel = computed(() => allows('cancel'))
// One Delete button: the backend picks destroy (resources may exist) or a
// straight soft-delete.
const canDelete = computed(() => allows('destroy') || allows('delete'))
// Per-VM redeploy / per-workload restart and reset.
const canRedeploy = computed(() => allows('redeploy'))

const cancelBusy = ref(false)

// Cancel revokes the worker task and then runs a destroy that also
// reaps the Packer build instance, so the response is the same 202
// ``{task_id, status: "destroying"}`` shape the delete path returns and
// the existing SSE plumbing takes over unchanged.
const confirmCancel = async () => {
    if (!deploymentId || cancelBusy.value) return
    cancelBusy.value = true
    try {
        await deploymentStore.cancelDeployment(deploymentId)
        showCancelModal.value = false
        toastStore.addToast({
            type: 'info',
            message: t('DeploymentDetailView.stopStartedToast'),
        })
        await deploymentStore.fetchDeploymentById(deploymentId)
        await loadTasks()
    } catch (err) {
        toastStore.addToast({
            type: 'error',
            message: localizedError(err, t, te, t('DeploymentDetailView.stopFailedToast')),
        })
    } finally {
        cancelBusy.value = false
    }
}

const showCancelModal = ref(false)

const deleteDisabledReason = computed(() => (canDelete.value ? '' : t('DeploymentDetailView.deleteUnavailable')))

// One Pause/Resume button — what it does depends on status. Most
// common case: ``success`` → Pause; ``paused`` → Resume. Failure
// states also expose a retry that matches what just broke.
const canPause = computed(() => allows('pause'))
const canResume = computed(() => allows('resume'))
const canPauseOrResume = computed(() => canPause.value || canResume.value)
const pauseResumeAction = computed<'pause' | 'resume' | null>(() => {
    const s = deployment.value?.status
    if (canPause.value && (s === 'success' || s === 'pause_failed' || s === 'redeploy_failed')) return 'pause'
    if (canResume.value && (s === 'paused' || s === 'resume_failed')) return 'resume'
    if (canPause.value) return 'pause'
    if (canResume.value) return 'resume'
    return null
})

const showDeleteModal = ref(false)
// Per-VM redeploy confirmation. Mirrors the Delete-modal pattern, but
// the action targets a single resource (identified by its TF state
// address), so we also remember which VM the user clicked while the
// modal is open.
const showRedeployModal = ref(false)
const redeployTargetAddress = ref<string | null>(null)
const showPauseResumeModal = ref(false)
const pauseResumeBusy = ref(false)

onMounted(async () => {
    await deploymentStore.fetchDeploymentById(deploymentId)

    if (!deploymentStore.currentDeployment) {
        toastStore.error(
            deploymentStore.error
                ? t('DeploymentDetailView.noAccess')
                : t('DeploymentDetailView.notFound')
        )
        router.push({ name: 'deployments.list' })
        return
    }

    await loadTasks() // Loads the history into tasks.value
    await loadMyAccess()

    // Fire the resource load in parallel — it's a separate roundtrip
    // (OpenStack live-fetch can take ~1s) and the page should render
    // its other panels while it's in flight.
    loadResources()
})

// Members (owner included, when they are in a team) get their own access
// from ``/my-access`` — the only place credentials come from.
const loadMyAccess = async () => {
    if (!permissions.value.member) return
    try {
        const { data } = await deploymentApi.getMyAccess(deploymentId)
        myAccounts.value = (data.user_accounts ?? null) as Record<string, UserAccount> | null
        myTeamVms.value = (data.team_vms ?? null) as Record<string, TeamVm> | null
    } catch (err) {
        console.error('Error loading own access credentials:', err)
    }
}

const loadTasks = async () => {
    // Members can't read tasks (backend returns 403 for the
    // owner-only endpoint). Skip the call entirely so the network
    // tab stays clean and the UI doesn't briefly flicker a loader
    // for data we'll never receive.
    if (!isOwnerView.value) {
        tasks.value = []
        return
    }
    loadingTasks.value = true
    try {
        const { data } = await taskApi.listByDeployment(deploymentId)
        tasks.value = data
    } catch (err) {
        console.error('Error loading tasks:', err)
    } finally {
        loadingTasks.value = false
    }
}

// ----------------------------------------------------------------
// LIVE STREAM (progress bar + log tail)
// ----------------------------------------------------------------
//
// We attach the SSE stream once we know the deployment ID and keep it
// open until the task reaches a terminal state. The composable
// auto-reconnects on transient errors and exposes ``connectionState``
// for a small status badge.
//
// Refs are destructured out of the composable so Vue's template
// auto-unwrap recognises them as top-level setup bindings — without
// destructuring, ``stream.currentPhase`` in the template would be the
// ref *object*, not the string, and downstream calls like
// ``phase.split(...)`` would crash.
const deploymentIdRef = computed(() => deploymentId)
const {
    progress: streamProgress,
    currentPhase: streamCurrentPhase,
    currentPhaseIndex: streamCurrentPhaseIndex,
    totalPhases: streamTotalPhases,
    phaseNames: streamPhaseNames,
    liveLogs: streamLiveLogs,
    totalLogCount: streamTotalLogCount,
    connectionState: streamConnectionState,
    start: startStream,
    stop: stopStream,
} = useDeploymentStream(deploymentIdRef)

const activeTask = computed<Task | null>(() => {
    if (!tasks.value.length) return null
    // The "active" task is the one we still expect events from.
    // Fall back to the latest task by created_at if all are terminal —
    // its progress columns may still be useful for context.
    const sorted = [...tasks.value].sort((a, b) => b.created_at.localeCompare(a.created_at))
    return sorted.find((t) => t.status === 'pending' || t.status === 'running') ?? sorted[0] ?? null
})

const isStreamRelevant = computed(() => {
    // Members never get the live stream — backend would 403 the SSE
    // endpoint anyway, the gate here just keeps the UI from poking
    // at it. Owners see the stream while there's an active task.
    if (!isOwnerView.value) return false
    return activeTask.value?.status === 'pending' || activeTask.value?.status === 'running'
})

// Tasks that aren't the currently running one. Shown as the history
// list below the active-task card so the running task isn't rendered
// twice (once in the live block, once in the static list).
const historyTasks = computed<Task[]>(() => {
    const active = activeTask.value
    const list = [...tasks.value].sort((a, b) => b.created_at.localeCompare(a.created_at))
    if (!active || !isStreamRelevant.value) return list
    return list.filter((t) => t.taskId !== active.taskId)
})

// Phase stepper. The label tables and the worker-authoritative
// resolution order live in the composable — see its module docs.
const { phaseStepCount, phaseStepLabel, currentPhaseIndex, phaseLabel } = useDeploymentPhases({
    streamTotalPhases,
    streamPhaseNames,
    streamCurrentPhaseIndex,
    streamProgress,
    activeTask,
})

// Initialise progress bar + stepper from whatever the DB has on the
// latest task — covers the gap between page load and the first SSE
// event. Important when the user opens the detail view *mid-deploy*:
// without a seed they'd see the loader card until the next worker
// progress event, which can be 30s+ during long phases like
// ``terraform apply``.
//
// Only seed from a *live* task. The persisted progress columns of a
// finished deploy would otherwise paint the stepper at 100% / phase
// "OUTPUTS_AND_CLEANUP" right after the user clicks delete, before
// the new destroy task's first progress event arrives.
watch(
    activeTask,
    (task) => {
        if (!task) return
        const live = task.status === 'pending' || task.status === 'running'
        if (!live) return
        if (task.progress_pct != null && streamProgress.value === null) {
            streamProgress.value = task.progress_pct
        }
        if (task.current_phase && streamCurrentPhase.value === null) {
            streamCurrentPhase.value = task.current_phase
            // Approximate the phase index from the persisted percent so the
            // stepper renders meaningfully before the first SSE progress event
            // lands, mirroring the worker's own round(idx/total*100) math.
            if (task.progress_pct != null && streamCurrentPhaseIndex.value === null) {
                const total = streamTotalPhases.value || DEFAULT_PHASE_COUNT
                streamCurrentPhaseIndex.value = Math.max(
                    1,
                    Math.min(total, Math.round((task.progress_pct / 100) * total)),
                )
            }
        }
    },
    { immediate: true },
)

watch(
    isStreamRelevant,
    (relevant, wasRelevant) => {
        if (relevant && !wasRelevant) {
            startStream()
        } else if (!relevant && wasRelevant) {
            stopStream()
            // Refresh the task list once on completion so the final
            // logs land in the static rendering below; a finished deploy
            // also brings the member's access data.
            loadTasks()
            loadMyAccess()
            // A redeploy task that just finished produces a new TF
            // state — reload the resource list so the redrawn card
            // reflects post-apply lifecycle. We also clear the
            // in-flight set; whichever address was waiting on this
            // task is now in the freshly-fetched list.
            redeployInFlight.value.clear()
            loadResources()
        }
    },
    { immediate: true },
)

// When the SSE stream ends (terminal lifecycle event), reload the deployment +
// tasks so the view switches from the live progress bar to the static render.
//
// Special case: a successful destroy auto-soft-deletes the deployment, so the
// row disappears. Detected either via the last active task being a terminal
// DESTROY, or via the refetch returning no current deployment (the store
// swallows the 404 into ``state.error``, so we check ``currentDeployment``).
watch(streamConnectionState, async (state) => {
    if (state !== 'ended') return

    const wasDestroy = activeTask.value?.type === 'destroy'
    // Snapshot the active task BEFORE the refetch so we can decide
    // whether to fire a pause/resume failure toast even when the
    // refresh races and clears the live state.
    const lastActiveType = activeTask.value?.type
    const lastActiveStatus = activeTask.value?.status

    await deploymentStore.fetchDeploymentById(deploymentId)
    await loadTasks()

    // The deployment row only disappears when destroy actually succeeded (the
    // celery listener auto-soft-deletes on ``task-succeeded`` of a DESTROY task).
    // A failed destroy leaves the row so the user can read the logs.
    const gone = !deploymentStore.currentDeployment
        || deploymentStore.currentDeployment.deploymentId !== deploymentId

    if (gone) {
        // Soft-deleted upstream — the destroy ran clean.
        toastStore.addToast({
            type: 'success',
            message: t('DeploymentDetailView.deleteSuccessToast'),
        })
        router.push({ name: 'deployments.list' })
        return
    }

    // Destroy attempted but the row still exists → it failed. Show a clear
    // error toast and leave the user on the detail page to inspect the logs.
    if (wasDestroy) {
        toastStore.addToast({
            type: 'error',
            message: t('DeploymentDetailView.deleteFailedAsyncToast'),
        })
        return
    }

    // Pause/Resume failed asynchronously. ``activeTask`` is no longer set, so
    // look at the newest task. The toast is kept separate from the logs panel
    // to give a clear "the lifecycle pass failed but the deployment is still up"
    // hint without pulling raw exception text into the toast.
    const sortedTasks = [...(tasks.value || [])]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    const newestTask = sortedTasks[0]
    const failedKind = (newestTask?.type === 'pause' || newestTask?.type === 'resume')
        && newestTask.status === 'failed'
        ? newestTask.type
        : null
    // Belt-and-braces: even if loadTasks() raced, the snapshot from
    // before the await should still tell us what was active.
    const fallbackKind = (lastActiveType === 'pause' || lastActiveType === 'resume')
        && lastActiveStatus === 'failed'
        ? lastActiveType
        : null
    const kind = failedKind || fallbackKind
    if (kind === 'pause') {
        toastStore.addToast({
            type: 'error',
            message: t('DeploymentDetailView.pauseFailedAsyncToast'),
        })
    } else if (kind === 'resume') {
        toastStore.addToast({
            type: 'error',
            message: t('DeploymentDetailView.resumeFailedAsyncToast'),
        })
    }
})

onBeforeUnmount(() => {
    stopStream()
})

// Pretty phase label for the progress bar header. Keeps the enum
// naming convention from the worker (UPPER_SNAKE_CASE) but renders
// it human-friendly. Defensive: anything that isn't a non-empty
// string falls back to an empty label so the template never sees a
// non-string slip through (e.g. the brief moment an unwrapped ref
// produced the original ``phase.split is not a function`` crash).
// Pretty-print arbitrary JSON-ish values for the terraform state /
// outputs / raw-logs blocks. The backend persists these as TEXT
// columns, so they arrive as either:
//
//  * a JSON string (terraform state pulled from the pg backend, or the
//    JSON-stringified outputs map),
//  * a real object/array (when the API layer has already parsed it),
//  * a plain non-JSON string (a stack trace, a single error line),
//  * null / undefined when the worker had nothing to record.
//
// The helper unifies those into a 2-space-indented JSON dump when the
// payload parses, and falls back to the raw text otherwise so we never
// clobber a non-JSON string by trying to parse it.

// Copy-to-clipboard state. Each "card" (logs/state/outputs) tags its
// copy button with a unique key; the key of whichever was last
// successfully copied is stored here for ~1.5s so we can flip its
// icon to a check as feedback. Multiple cards can share the same state
// because only one can be the "just copied" target at a time.
const copiedKey = ref<string | null>(null)
let copyResetTimer: number | null = null

const copyToClipboard = async (text: string, key: string) => {
    if (!text) return
    try {
        // Modern ``navigator.clipboard`` requires a secure context
        // (https or localhost). Falls back to the legacy
        // ``execCommand('copy')`` so the button still works behind
        // plain http on the dev box.
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text)
        } else {
            const ta = document.createElement('textarea')
            ta.value = text
            ta.style.position = 'fixed'
            ta.style.opacity = '0'
            document.body.appendChild(ta)
            ta.select()
            document.execCommand('copy')
            document.body.removeChild(ta)
        }
        copiedKey.value = key
        if (copyResetTimer !== null) window.clearTimeout(copyResetTimer)
        copyResetTimer = window.setTimeout(() => {
            copiedKey.value = null
            copyResetTimer = null
        }, 1500)
    } catch (err) {
        console.error('Copy failed:', err)
    }
}

// Count of log entries inside ``selectedTask.logs`` for the badge in
// the Logs card header. Logs arrive in three flavours:
//
//  * an object ``{logs: [...], error?: ...}`` — the Failure payload
//    serialised by the worker on a failed deploy
//  * a plain array on the success path (the success result is just
//    ``logs: list[dict]``)
//  * a JSON string when the API serialises one of the above as text
//
// The computed handles all three so the "N entries" pill stays
// accurate regardless of the wire shape; returns null when the count
// can't be determined (e.g. logs is a non-JSON string), in which case
// the badge is hidden.
const logEntryCount = computed<number | null>(() => {
    const raw = selectedTask.value?.logs
    if (raw == null) return null
    let value: unknown = raw
    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (
            (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))
        ) {
            try {
                value = JSON.parse(trimmed)
            } catch {
                return null
            }
        } else {
            return null
        }
    }
    if (Array.isArray(value)) return value.length
    if (value && typeof value === 'object') {
        const inner = (value as Record<string, unknown>).logs
        if (Array.isArray(inner)) return inner.length
    }
    return null
})


const deploymentTimestamp = computed(() => {
    return deployment.value?.created_at ? formatDate(deployment.value.created_at) : '-'
})

const getStatusStyles = (status?: string) => {
    switch (status) {
        case 'success':
            return {
                label: 'DeploymentsView.deploymentSuccessful',
                dotClass: 'bg-green-500 shadow-[0_0_10px_rgb(var(--color-status-green)/0.4)]',
                textClass: 'text-gray-900',
                badgeClass: 'bg-green-100 text-green-800 border-green-300',
                icon: CheckCircle
            }
        case 'running':
            return {
                label: 'DeploymentsView.deploymentRunning',
                dotClass: 'bg-blue-500 animate-pulse shadow-[0_0_12px_rgb(var(--color-info)/0.6)]',
                textClass: 'text-gray-900',
                badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
                icon: Loader2
            }
        case 'pending':
            return {
                label: 'DeploymentsView.deploymentPending',
                dotClass: 'bg-yellow-500 shadow-[0_0_10px_rgb(var(--color-status-yellow)/0.4)]',
                textClass: 'text-gray-900',
                badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-300',
                icon: Clock
            }
        case 'failed':
            return {
                label: 'DeploymentsView.deploymentFailed',
                dotClass: 'bg-red-500 shadow-[0_0_10px_rgb(var(--color-danger)/0.4)]',
                textClass: 'text-gray-900',
                badgeClass: 'bg-red-100 text-red-800 border-red-300',
                icon: XCircle
            }
        case 'destroying':
            return {
                label: 'DeploymentsView.deploymentDestroying',
                dotClass: 'bg-orange-500 animate-pulse shadow-[0_0_12px_rgb(var(--color-status-orange)/0.6)]',
                textClass: 'text-gray-900',
                badgeClass: 'bg-orange-100 text-orange-700 border-orange-300',
                icon: Loader2
            }
        case 'cancelled':
            return {
                label: 'DeploymentsView.deploymentCancelled',
                dotClass: 'bg-gray-400',
                textClass: 'text-gray-900',
                badgeClass: 'bg-gray-100 text-gray-700 border-gray-300',
                icon: StopCircle
            }
        case 'destroyed':
            return {
                label: 'DeploymentsView.deploymentDestroyed',
                dotClass: 'bg-orange-500 shadow-[0_0_10px_rgb(var(--color-status-orange)/0.4)]',
                textClass: 'text-gray-900',
                badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
                icon: Flame
            }
        case 'pausing':
            return {
                // ``pausing``/``resuming`` borrow the orange "in flight"
                // palette from destroying — the user reads "something
                // active is happening" at a glance, distinct from the
                // calm green of success.
                label: 'DeploymentsView.deploymentPausing',
                dotClass: 'bg-amber-500 animate-pulse shadow-[0_0_12px_rgb(var(--color-warning)/0.6)]',
                textClass: 'text-gray-900',
                badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
                icon: Loader2
            }
        case 'paused':
            return {
                label: 'DeploymentsView.deploymentPaused',
                dotClass: 'bg-slate-400 shadow-[0_0_10px_rgb(var(--color-status-slate)/0.4)]',
                textClass: 'text-gray-900',
                badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
                icon: PauseCircle
            }
        case 'resuming':
            return {
                label: 'DeploymentsView.deploymentResuming',
                dotClass: 'bg-emerald-500 animate-pulse shadow-[0_0_12px_rgb(var(--color-success)/0.6)]',
                textClass: 'text-gray-900',
                badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                icon: Loader2
            }
        case 'pause_failed':
            // The deployment itself is unaffected — only the
            // pause-pass tripped. Use the warning palette so the
            // user reads "needs attention" rather than the harsher
            // red of a deploy-failed.
            return {
                label: 'DeploymentsView.deploymentPauseFailed',
                dotClass: 'bg-amber-500 shadow-[0_0_10px_rgb(var(--color-warning)/0.4)]',
                textClass: 'text-gray-900',
                badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
                icon: AlertCircle
            }
        case 'redeploying':
            return {
                label: 'DeploymentsView.deploymentRedeploying',
                dotClass: 'bg-blue-500 animate-pulse shadow-[0_0_12px_rgb(var(--color-info)/0.6)]',
                textClass: 'text-gray-900',
                badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
                icon: Loader2
            }
        case 'redeploy_failed':
            // Only the one VM or workload is in doubt; the rest keeps running.
            return {
                label: 'DeploymentsView.deploymentRedeployFailed',
                dotClass: 'bg-amber-500 shadow-[0_0_10px_rgb(var(--color-warning)/0.4)]',
                textClass: 'text-gray-900',
                badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
                icon: AlertCircle
            }
        case 'resume_failed':
            return {
                label: 'DeploymentsView.deploymentResumeFailed',
                dotClass: 'bg-amber-500 shadow-[0_0_10px_rgb(var(--color-warning)/0.4)]',
                textClass: 'text-gray-900',
                badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
                icon: AlertCircle
            }
        default:
            return {
                label: 'DeploymentsView.noStatus',
                dotClass: 'bg-gray-300',
                textClass: 'text-gray-400',
                badgeClass: 'bg-gray-100 text-gray-800 border-gray-300',
                icon: AlertCircle
            }
    }
}

const selectedGroup = ref<number | null>(null)

const selectGroup = (groupIndex: number) => {
    selectedGroup.value = groupIndex
}

const deselectGroup = () => {
    selectedGroup.value = null
}

const groups = computed(() => {
    if (!deployment.value?.userInputVar) return []

    try {
        const data = typeof deployment.value.userInputVar === 'string'
            ? JSON.parse(deployment.value.userInputVar)
            : deployment.value.userInputVar
        const groupNames = data.groupNames || []
        const assignments = data.assignments || {}

        return Object.keys(assignments).map((groupIndex, idx) => ({
            index: parseInt(groupIndex),
            name: groupNames[idx] || `Gruppe ${parseInt(groupIndex) + 1}`,
            students: assignments[groupIndex] || []
        }))
    } catch (e) {
        console.error('Error parsing userInputVar:', e)
        return []
    }
})

const currentGroup = computed(() => {
    if (selectedGroup.value === null) return null
    return groups.value[selectedGroup.value] ?? null
})

const deploymentVariables = computed(() => {
    if (!deployment.value?.userInputVar) return {}

    try {
        const data = typeof deployment.value.userInputVar === 'string'
            ? JSON.parse(deployment.value.userInputVar)
            : deployment.value.userInputVar
        return data.variables || {}
    } catch (e) {
        console.error('Error parsing userInputVar:', e)
        return {}
    }
})

const cleanVariableValue = (value?: string) => {
    const str = String(value ?? '')
    let cleaned = str.split('#')[0]?.trim() ?? ''
    cleaned = cleaned.replace(/["']/g, '')
    return cleaned.trim() || '-'
}

/**
 * Split a task-logs string into a friendly headline + a collapsible
 * technical-details body. The backend's ``celery_event_listener.py``
 * emits Celery-infrastructure failures (``NotRegistered``,
 * ``WorkerLostError``, …) in a stable two-section format separated
 * by ``--- Technische Details ---``; we honour that boundary so the
 * raw stack trace stays available but isn't shoved into the user's
 * face by default.
 *
 * Returns ``{headline, details, isFailure}`` — ``isFailure`` lets
 * the template pick the destructive palette without re-doing the
 * regex on render.
 */
const FAILURE_DETAIL_DIVIDER = '--- Technische Details ---'

const splitTaskLogs = (raw: string | Record<string, unknown> | null | undefined) => {
    if (!raw) return { headline: '', details: '', isFailure: false }
    const text = String(raw)
    // Backend "infra" failure with the explicit divider — we get a
    // one-line headline and a raw block underneath.
    const dividerIdx = text.indexOf(FAILURE_DETAIL_DIVIDER)
    if (dividerIdx >= 0) {
        return {
            headline: text.slice(0, dividerIdx).trim(),
            details: text.slice(dividerIdx + FAILURE_DETAIL_DIVIDER.length).trim(),
            isFailure: true,
        }
    }
    // Fallback: the legacy ``Task failed: ...\n<traceback>`` shape.
    // Take the first line as headline if the body is multi-line.
    if (text.startsWith('Task failed:')) {
        const newlineIdx = text.indexOf('\n')
        if (newlineIdx > 0) {
            return {
                headline: text.slice(0, newlineIdx).trim(),
                details: text.slice(newlineIdx + 1).trim(),
                isFailure: true,
            }
        }
        return { headline: text.trim(), details: '', isFailure: true }
    }
    return { headline: '', details: '', isFailure: false }
}

// ``logs`` can be either a backend-formatted ``Task failed: ...`` string
// (the failure shape this splitter cares about) or a structured
// ``TaskLogsObject`` for normal runs. Only the string form triggers the
// headline/details split — anything else falls through to the generic
// pretty-print path below.
const taskLogsSplit = computed(() => {
  const raw = selectedTask.value?.logs
  return splitTaskLogs(typeof raw === 'string' ? raw : null)
})
const showTaskLogsTrace = ref(false)

// Unified delete handler. The backend's DELETE endpoint returns 202
// when it dispatched a destroy task (live progress to follow) or 204
// when it soft-deleted directly (no resources to clean up). Branch
// on response.status so the UX matches what's actually happening:
//   * 202 → stay on the page, refresh tasks so the live stream
//     attaches to the new DESTROY task; the streamConnectionState
//     watcher routes back to the list when the task completes.
//   * 204 → leave immediately with a success toast.
const confirmDelete = async () => {
    if (!deploymentId) return
    try {
        const response = await deploymentStore.deleteDeployment(deploymentId)
        if (response?.status === 202) {
            // Destroy task dispatched. Reload deployment + tasks so
            // ``activeTask`` flips to the new DESTROY row and the
            // live-progress card swaps in.
            toastStore.addToast({
                type: 'info',
                message: t('DeploymentDetailView.deleteStartedToast'),
            })
            await deploymentStore.fetchDeploymentById(deploymentId)
            await loadTasks()
        } else {
            // 204: nothing to destroy, soft-delete completed
            // synchronously. Row is gone — back to the list.
            toastStore.addToast({
                type: 'success',
                message: t('DeploymentDetailView.deleteSuccessToast'),
            })
            router.push({ name: 'deployments.list' })
        }
    } catch (err: any) {
        toastStore.addToast({
            type: 'error',
            message: `${t('DeploymentDetailView.deleteErrorToast')}: ` + localizedError(err, t, te),
        })
    } finally {
        showDeleteModal.value = false
    }
}

// Redeploy confirmation handler — close the modal first (so the user
// gets immediate visual feedback that their click registered) and
// then dispatch the actual API call. ``executeRedeploy`` owns its
// own toast handling and adds/removes the in-flight marker.
const confirmRedeploy = async () => {
    const address = redeployTargetAddress.value
    showRedeployModal.value = false
    if (!address) return
    try {
        await executeRedeploy(address)
    } finally {
        redeployTargetAddress.value = null
    }
}

// Pause / resume handler — same wiring as ``confirmDelete``: the
// backend returns 202 with a ``task_id`` when it dispatched the
// worker, so we just reload the deployment + tasks and the existing
// SSE stream / activeTask plumbing takes over from there. The button
// itself is hidden while ``pausing``/``resuming`` so the user can't
// double-click; ``pauseResumeBusy`` debounces the in-flight HTTP call
// in case the click lands faster than the deployment status refresh.
const confirmPauseResume = async () => {
    if (!deploymentId || pauseResumeBusy.value) return
    const action = pauseResumeAction.value
    if (!action) return
    pauseResumeBusy.value = true
    try {
        const call = action === 'pause'
            ? deploymentStore.pauseDeployment(deploymentId)
            : deploymentStore.resumeDeployment(deploymentId)
        await call
        toastStore.addToast({
            type: 'info',
            message: action === 'pause'
                ? t('DeploymentDetailView.pauseStartedToast')
                : t('DeploymentDetailView.resumeStartedToast'),
        })
        await deploymentStore.fetchDeploymentById(deploymentId)
        await loadTasks()
    } catch (err: any) {
        toastStore.addToast({
            type: 'error',
            message: (action === 'pause'
                ? t('DeploymentDetailView.pauseErrorToast')
                : t('DeploymentDetailView.resumeErrorToast'))
                + ': '
                + localizedError(err, t, te),
        })
    } finally {
        pauseResumeBusy.value = false
        showPauseResumeModal.value = false
    }
}

const formatDate = formatDateTime

const selectTask = async (task: Task) => {
    loadingTaskDetail.value = true
    try {
        const { data } = await taskApi.getById(task.taskId)
        selectedTask.value = data
    } catch (err) {
        console.error('Error loading task details:', err)
        toastStore.addToast({
            type: 'error',
            message: 'Failed to load task details'
        })
    } finally {
        loadingTaskDetail.value = false
    }
}

const deselectTask = () => {
    selectedTask.value = null
}
</script>


<template>
    <div v-if="deployment" class="space-y-6">
        <!--
            Two-column layout: the deployment detail content stays on the left,
            and the VM-detail sidebar anchors as a sticky right column when an
            inline VM is selected. The left column expands to full width otherwise.
        -->
        <div class="flex gap-6 items-start">
            <div class="flex-1 min-w-0 space-y-6">

        <!-- Header with back button and status badge -->
        <div class="flex flex-wrap gap-4 items-center justify-between">
            <div class="flex items-center gap-4">
                <RouterLink :to="{ name: 'deployments.list' }">
                    <button
                        class="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 transition">
                        <CircleArrowLeft :size="24" class="text-gray-700" />
                    </button>
                </RouterLink>

                <div>
                    <h1 class="text-3xl font-bold text-gray-900">{{ deployment.name }}</h1>
                    <p class="text-sm text-gray-500 mt-1">Deployment Details</p>
                </div>
            </div>

            <div class="flex items-center gap-4">
                <div class="flex items-center gap-3">
                    <component :is="getStatusStyles(deployment.status).icon" :size="20" :class="deployment.status === 'success' ? 'text-green-600' :
                        deployment.status === 'failed' ? 'text-red-600' :
                            deployment.status === 'running' ? 'text-blue-600' : 'text-yellow-600'" />
                    <span
                        class="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold border capitalize"
                        :class="getStatusStyles(deployment.status).badgeClass">
                        {{ $t(getStatusStyles(deployment.status).label) }}
                    </span>
                </div>

                <!-- Pause / Resume button. One slot, two states, visible only
                     when the lifecycle matrix permits the action right now. -->
                <BaseButton
                    v-if="canPauseOrResume"
                    @click="!pauseResumeBusy && (showPauseResumeModal = true)"
                    :disabled="pauseResumeBusy"
                    :title="pauseResumeAction === 'pause'
                        ? $t('DeploymentDetailView.pauseTooltip')
                        : $t('DeploymentDetailView.resumeTooltip')"
                    class="flex items-center gap-2 px-4 py-2"
                    :variant="pauseResumeAction === 'pause' ? 'primary' : 'secondary'">
                    <PauseCircle v-if="pauseResumeAction === 'pause'" :size="18" />
                    <PlayCircle v-else :size="18" />
                    <span class="font-medium">
                        {{ pauseResumeAction === 'pause'
                            ? $t('DeploymentDetailView.deploymentPause')
                            : $t('DeploymentDetailView.deploymentResume') }}
                    </span>
                </BaseButton>

                <!-- Stop: only while a worker task is in flight. Revokes
                     the task and cleans up everything it created, including
                     the Packer build instance Terraform knows nothing about. -->
                <BaseButton v-if="canCancel" @click="showCancelModal = true" :disabled="cancelBusy"
                    class="flex items-center gap-2 px-4 py-2" variant="primary">
                    <StopCircle :size="18" />
                    <span class="font-medium">{{ $t('DeploymentDetailView.deploymentStop') }}</span>
                </BaseButton>

                <!-- Single Delete button. The backend decides whether this
                     triggers a destroy task or a straight soft-delete based on
                     status. Hidden entirely for members. -->
                <BaseButton v-if="isOwnerView" data-testid="btn-delete-deployment" @click="canDelete && (showDeleteModal = true)" :disabled="!canDelete"
                    :title="deleteDisabledReason" class="flex items-center gap-2 px-4 py-2" variant="destructive">
                    <Trash2 :size="18" />
                    <span class="font-medium">{{ $t('DeploymentDetailView.deploymentDelete') }}</span>
                </BaseButton>
            </div>
        </div>

        <!-- Main info grid with 3 cards -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

            <!-- Deployment info card -->
            <div class="detail-surface">
                <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Package :size="20" class="text-primary" />
                    Deployment Info
                </h2>
                <div class="space-y-4">
                    <div>
                        <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">
                            {{ $t('DeploymentsView.deploymentName') }}
                        </div>
                        <div class="text-sm font-medium text-gray-900">{{ deployment.name }}</div>
                    </div>
                    <div>
                        <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Release Tag</div>
                        <div class="text-sm flex flex-wrap items-center gap-2">
                            <span
                                class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300">
                                <GitBranch :size="12" class="mr-1" />
                                {{ deployment.releaseTag }}
                            </span>
                            <span v-if="deployment.commit_sha" class="font-mono text-xs text-gray-500" :title="deployment.commit_sha">
                                {{ deployment.commit_sha.slice(0, 8) }}
                            </span>
                        </div>
                    </div>
                    <div>
                        <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">{{ $t('DeploymentDetailView.runtime') }}</div>
                        <div class="text-sm font-medium text-gray-900" data-testid="deployment-runtime">
                            {{ isPods ? $t('runtime.kubernetes') : $t('runtime.openstackVm') }}
                        </div>
                    </div>
                    <div>
                        <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">
                            {{ $t('DeploymentDetailView.deploymentCreated') }}
                        </div>
                        <div class="text-sm font-medium text-gray-700 flex items-center gap-1">
                            <Calendar :size="14" />
                            {{ deploymentTimestamp }}
                        </div>
                    </div>
                </div>
            </div>

            <!-- App info card -->
            <div class="detail-surface">
                <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Package :size="20" class="text-emerald-600" />
                    {{ $t('DeploymentsView.deploymentApp') }}
                </h2>
                <div class="space-y-4" v-if="deployment.app">
                    <div>
                        <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">App Name</div>
                        <div class="text-sm font-medium text-gray-900">{{ deployment.app.name }}</div>
                    </div>
                    <div>
                        <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">{{
                            $t('DeploymentDetailView.deploymentDescription') }}</div>
                        <MarkdownRenderer
                            v-if="deployment.app.description && deployment.app.description.trim()"
                            :source="deployment.app.description"
                            variant="compact"
                            :clamp="3"
                            :expandable="true"
                            class="text-sm"
                        />
                        <div v-else class="text-sm text-gray-500 italic">No description</div>
                    </div>
                    <div>
                        <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Git Repository</div>
                        <a :href="deployment.app.git_link ?? undefined" target="_blank"
                            class="text-sm text-blue-600 hover:text-blue-800 underline break-all">
                            {{ deployment.app.git_link }}
                        </a>
                    </div>
                </div>
                <div v-else class="text-sm text-gray-500">No app information available</div>
            </div>

            <!-- User info card -->
            <div class="detail-surface">
                <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <User :size="20" class="text-blue-600" />
                    {{ $t('DeploymentDetailView.deploymentOwner') }}
                </h2>
                <div class="space-y-4" v-if="deployment.user">
                    <div>
                        <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">{{
                            $t('DeploymentDetailView.deploymentUserName') }}</div>
                        <div class="text-sm font-medium text-gray-900 flex items-center gap-2">
                            <div
                                class="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary font-bold">
                                {{ deployment.user.username.substring(0, 2).toUpperCase() }}
                            </div>
                            {{ deployment.user.username }}
                        </div>
                    </div>
                    <div>
                        <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Email</div>
                        <div class="text-sm text-gray-700">{{ deployment.user.email }}</div>
                    </div>
                    <div>
                        <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">{{
                            $t('DeploymentDetailView.deploymentUserRole') }}</div>
                        <div class="text-sm">
                            <span
                                class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300 capitalize">
                                {{ deployment.user.role }}
                            </span>
                        </div>
                    </div>
                </div>
                <div v-else class="text-sm text-gray-500">No user information available</div>
            </div>
        </div>

        <!-- Groups section -->
        <div class="detail-surface" v-if="groups.length > 0">
            <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users :size="20" class="text-primary" />
                {{ $t('DeploymentDetailView.deploymentGroups') }}
            </h2>

            <Transition mode="out-in" enter-active-class="transition-all duration-200 ease-out"
                enter-from-class="opacity-0 translate-x-2" enter-to-class="opacity-100 translate-x-0"
                leave-active-class="transition-all duration-200 ease-out absolute top-0 left-0 right-0"
                leave-from-class="opacity-100 translate-x-0" leave-to-class="opacity-0 -translate-x-2">
                <div v-if="currentGroup" key="detail" class="bg-gray-50 rounded-lg p-4">

                    <button @click="deselectGroup"
                        class="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors mb-3 group">
                        <CircleArrowLeft :size="20" class="group-hover:-translate-x-1 transition-transform" />
                        <span class="text-sm font-medium">{{ $t('DeploymentDetailView.deploymentGroupsBack') }}</span>
                    </button>

                    <div class="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                        <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <span class="text-primary font-bold text-sm">{{ currentGroup.index + 1 }}</span>
                        </div>
                        <div class="font-semibold text-lg">{{ currentGroup.name }}</div>
                    </div>

                    <div class="space-y-2">
                        <div class="text-xs text-gray-500 uppercase tracking-wide mb-2">
                            {{ $t('DeploymentDetailView.deploymentStudentCount', {
                                n: currentGroup?.students?.length ||
                                    0
                            }, currentGroup?.students?.length || 0) }}
                        </div>
                        <div v-for="(student, idx) in currentGroup.students" :key="student"
                            class="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-gray-200">
                            <div
                                class="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary font-bold">
                                {{ Number(idx) + 1 }}
                            </div>
                            <span class="font-mono text-sm text-gray-700">{{ student }}</span>
                        </div>
                    </div>
                </div>

                <div v-else key="overview" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div v-for="group in groups" :key="group.index" data-testid="group-card" @click="selectGroup(group.index)"
                        class="bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors border border-gray-200 hover:border-primary/30">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                <span class="text-primary font-bold text-sm">{{ group.index + 1 }}</span>
                            </div>
                            <div class="font-semibold">{{ group.name }}</div>
                        </div>
                        <div class="text-sm text-gray-600 ml-11">
                            {{ $t('DeploymentDetailView.deploymentStudentCount', { n: group.students.length },
                                group.students.length) }}
                        </div>
                    </div>
                </div>
            </Transition>
        </div>

        <!-- Deployment Variables -->
        <div class="detail-surface"
            v-if="Object.keys(deploymentVariables).length > 0">
            <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Settings :size="20" class="text-orange-600" />
                {{ $t('DeploymentDetailView.deploymentConfig') }}
            </h2>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div v-for="(value, key) in deploymentVariables" :key="key"
                    class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div class="text-xs text-gray-500 uppercase tracking-wide mb-1 font-mono">{{ key }}</div>
                    <div class="font-medium text-gray-800 break-all text-sm">
                        {{ cleanVariableValue(value) }}
                    </div>
                </div>
            </div>
        </div>

        <!-- Latest task info is shown inline in the Active Task card
             below while the deployment is running, and inline in the
             Tasks & Logs history once it has finished. The previous
             standalone "Latest Task" row was redundant with both. -->

        <!-- Active Task — live progress + log tail for the currently
             running task. Replaces the previous mix of "Latest Task"
             info card + duplicate entry in the Tasks & Logs list. -->
        <div v-if="isStreamRelevant && activeTask"
            class="bg-white rounded-xl border border-blue-300 shadow-sm overflow-hidden">
            <!-- Header strip: gradient + live indicator + task type/status -->
            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-200">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="relative">
                            <div class="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
                            <div class="absolute inset-0 w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></div>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-semibold text-gray-900 capitalize">{{ activeTask.type
                                }}</span>
                                <span class="text-xs font-medium text-gray-500">·</span>
                                <span class="text-xs text-gray-600">running since {{ formatDate(activeTask.started_at ||
                                    activeTask.created_at) }}</span>
                            </div>
                            <div class="text-xs text-gray-500 font-mono mt-0.5">{{ activeTask.taskId }}</div>
                        </div>
                    </div>
                    <span class="text-xs px-2 py-1 rounded-md font-medium" :class="streamConnectionState === 'live'
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : streamConnectionState === 'reconnecting'
                            ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'">
                        {{ streamConnectionState === 'live' ? 'Stream live' : streamConnectionState }}
                    </span>
                </div>
            </div>

            <!-- Body: progress bar + phase stepper + live tail -->
            <div class="p-6 space-y-5">
                <!-- The "Worker is starting up" loader covers the very
                     first seconds of a fresh task, before any phase
                     info is available — neither the SSE stream nor
                     the DB-seeded ``current_phase`` is set yet.
                     ``streamCurrentPhaseIndex`` carries either the
                     authoritative live value or the percent-derived
                     guess from the DB seed, so checking it alone is
                     enough to decide whether to render the stepper. -->
                <template v-if="streamCurrentPhaseIndex === null && !streamCurrentPhase">
                    <div class="flex items-center gap-3 py-6 justify-center text-gray-500">
                        <Loader2 class="animate-spin" :size="20" />
                        <span class="text-sm">Worker is starting up…</span>
                    </div>
                </template>
                <template v-else>
                    <!-- Progress headline -->
                    <div>
                        <div class="flex items-baseline justify-between mb-2">
                            <span class="text-base font-semibold text-gray-900">
                                {{ phaseLabel(streamCurrentPhase) || 'Starting…' }}
                            </span>
                            <span class="text-2xl font-bold text-gray-900 tabular-nums">
                                {{ streamProgress ?? 0 }}<span class="text-sm text-gray-500 font-medium">%</span>
                            </span>
                        </div>
                        <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div class="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-500 ease-out"
                                :style="{ width: (streamProgress ?? 0) + '%' }"></div>
                        </div>
                    </div>

                    <!-- Phase stepper. Renders ``phaseStepCount`` dots based
                         on the live ``totalPhases``, with labels picked by
                         the live total (matches deploy/destroy presets).
                         Generous ``py-3`` padding prevents the active
                         dot's ``ring-4`` + ``scale-125`` halo from clipping
                         against the parent's bottom edge. -->
                    <div class="flex items-start gap-1.5 overflow-x-auto py-3">
                        <template v-for="idx in phaseStepCount" :key="idx - 1">
                            <div class="flex-shrink-0 flex flex-col items-center gap-2 min-w-[60px]">
                                <div class="w-2.5 h-2.5 rounded-full transition-all" :class="(idx - 1) < currentPhaseIndex
                                    ? 'bg-blue-500'
                                    : (idx - 1) === currentPhaseIndex
                                        ? 'bg-blue-500 ring-4 ring-blue-200 scale-125'
                                        : 'bg-gray-200'"></div>
                                <span
                                    class="text-[10px] uppercase tracking-wide font-medium whitespace-nowrap text-center"
                                    :class="(idx - 1) <= currentPhaseIndex ? 'text-blue-700' : 'text-gray-400'">
                                    {{ phaseStepLabel(idx - 1) }}
                                </span>
                            </div>
                            <div v-if="(idx - 1) < phaseStepCount - 1" class="flex-1 h-px min-w-[8px] mt-[5px]"
                                :class="(idx - 1) < currentPhaseIndex ? 'bg-blue-300' : 'bg-gray-200'"></div>
                        </template>
                    </div>
                </template>

                <!-- Live log tail. ``streamTotalLogCount`` keeps
                     growing past the visible buffer (capped at 100
                     lines via the ring buffer in the composable),
                     so the user sees that the worker is still
                     producing output even after the box is full. -->
                <div v-if="streamLiveLogs.length > 0" class="space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="text-xs uppercase tracking-wide font-semibold text-gray-600">Live output</span>
                        <span class="text-xs text-gray-500">
                            {{ streamTotalLogCount.toLocaleString() }} {{ streamTotalLogCount === 1 ? 'line' : 'lines'
                            }}
                            <span v-if="streamLiveLogs.length < streamTotalLogCount" class="text-gray-400">
                                · last {{ streamLiveLogs.length }} shown
                            </span>
                        </span>
                    </div>
                    <div class="bg-gray-900 rounded-md p-3 max-h-72 overflow-y-auto font-mono text-xs">
                        <div v-for="(log, idx) in streamLiveLogs" :key="`${log.timestamp}-${idx}`"
                            class="text-gray-200 whitespace-pre-wrap break-words" :class="{
                                'text-red-400': log.level === 'ERROR',
                                'text-yellow-300': log.level === 'WARNING',
                                'text-green-400': log.level === 'SUCCESS',
                                'text-gray-400': log.streaming,
                            }">
                            <span class="text-gray-500 mr-2">{{ log.timestamp.split('T')[1]?.slice(0, 8) || '' }}</span>
                            <span v-if="log.tool" class="text-blue-400 mr-1">[{{ log.tool }}]</span>{{ log.message }}
                        </div>
                    </div>
                </div>
                <div v-else class="bg-gray-50 border border-gray-200 rounded-md p-4 text-center text-xs text-gray-500">
                    Waiting for first log line…
                </div>
            </div>
        </div>

        <!-- Teams & Members section — appears above Infrastructure so
             the human-readable view (who has access to what) precedes
             the technical resource listing. -->
        <div v-if="deployment.teams && deployment.teams.length > 0"
            class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-8">
            <div class="flex items-center gap-3 mb-5">
                <div class="p-2 bg-gray-100 rounded-lg">
                    <Users :size="20" class="text-gray-600" />
                </div>
                <span class="text-lg font-semibold text-gray-900">
                    {{ $t('DeploymentDetailView.teamsAndMembers') }}
                </span>
                <span class="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded">
                    {{ deployment.teams.length }}
                </span>
            </div>

            <div class="space-y-4">
                <div v-for="team in enrichedTeams" :key="team.teamId"
                    class="border border-gray-200 rounded-lg overflow-hidden">
                    <div class="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
                        <div class="flex items-center gap-2">
                            <span class="font-semibold text-gray-900">{{ team.name }}</span>
                            <span class="text-xs text-gray-500">·</span>
                            <span class="text-xs text-gray-600">
                                {{ team.members.length }}
                                {{ team.members.length === 1 ? 'member' : 'members' }}
                            </span>
                        </div>
                    </div>

                    <div v-if="team.members.length === 0" class="px-4 py-6 text-center text-sm text-gray-500">
                        No members assigned to this team.
                    </div>

                    <div v-else>
                        <div v-for="member in team.members" :key="member.userId"
                            :data-testid="`member-${member.userId}`"
                            class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-4 py-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors">

                            <div class="flex items-center gap-3 min-w-0 flex-1">
                                <div
                                    class="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                                    <User :size="16" />
                                </div>
                                <div class="min-w-0 pr-2">
                                    <div class="font-medium text-gray-900 truncate">{{ member.username }}</div>
                                    <div class="text-xs text-gray-500 truncate">{{ member.email }}</div>
                                </div>
                            </div>

                            <div v-if="member.account"
                                class="flex flex-wrap items-center gap-4 text-xs font-mono text-gray-600 lg:justify-end">

                                <!-- Web-app URL from ``team_vms.<team>.url``,
                                     shared by every team member. When set, the
                                     SSH pill is dropped and the username shows next to it. -->
                                <div v-if="(team.vm?.url || member.account.data.url) && member.account.data.username"
                                    class="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                    <span class="text-gray-400 font-sans text-[10px] uppercase tracking-wider flex-shrink-0">User:</span>
                                    <span>{{ member.account.data.username }}</span>
                                    <button
                                        @click="copyToClipboard(member.account.data.username ?? '', 'user-' + member.account.key)"
                                        class="text-gray-400 hover:text-amber-600 p-0.5 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
                                        :title="copiedKey === 'user-' + member.account.key ? 'Kopiert!' : 'Username kopieren'">
                                        <component :is="copiedKey === 'user-' + member.account.key ? Check : Copy" :size="12" />
                                    </button>
                                </div>

                                <!-- Ready-to-use RDP command line for Windows apps.
                                     Opt-in via ``authtype: "rdp"`` in user_accounts;
                                     without it nothing below changes for existing apps. -->
                                <div v-if="member.account.data.authtype === 'rdp' && member.account.data.ip"
                                    class="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border border-gray-100 max-w-full">
                                    <span class="text-gray-400 font-sans text-[10px] uppercase tracking-wider flex-shrink-0">RDP:</span>
                                    <span class="truncate">{{ rdpCommandFor(member.account.data) }}</span>
                                    <button
                                        @click="copyToClipboard(rdpCommandFor(member.account.data), 'rdp-' + member.account.key)"
                                        class="text-gray-400 hover:text-amber-600 p-0.5 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
                                        :title="copiedKey === 'rdp-' + member.account.key ? 'Kopiert!' : 'RDP-Befehl kopieren'">
                                        <component :is="copiedKey === 'rdp-' + member.account.key ? Check : Copy" :size="12" />
                                    </button>
                                </div>

                                <!-- Pods: each person's (or team's) own HTTPS link. -->
                                <div v-if="member.account.data.url && !team.vm?.url"
                                    class="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border border-gray-100 max-w-[280px]">
                                    <span class="text-gray-400 font-sans text-[10px] uppercase tracking-wider flex-shrink-0">URL:</span>
                                    <a :href="member.account.data.url" target="_blank" rel="noopener noreferrer"
                                        class="text-blue-600 hover:underline truncate">{{ member.account.data.url.replace(/^https?:\/\//, '') }}</a>
                                    <button
                                        @click="copyToClipboard(member.account.data.url ?? '', 'acturl-' + member.account.key)"
                                        class="text-gray-400 hover:text-amber-600 p-0.5 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
                                        :title="copiedKey === 'acturl-' + member.account.key ? $t('DeploymentDetailView.copied') : $t('DeploymentDetailView.copyUrl')">
                                        <component :is="copiedKey === 'acturl-' + member.account.key ? Check : Copy" :size="12" />
                                    </button>
                                </div>

                                <div v-else-if="member.account.data.ip && member.account.data.port && member.account.data.type !== 'ssh_key' && member.account.data.authtype !== 'ssh' && member.account.data.authtype !== 'rdp' && member.account.data.port !== 22"
                                    class="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border border-gray-100 max-w-[280px]">
                                    <span class="text-gray-400 font-sans text-[10px] uppercase tracking-wider flex-shrink-0">URL:</span>
                                    <a :href="userUrlFor(member.account.data, team.vm?.url) ?? ''" target="_blank" rel="noopener noreferrer"
                                        class="text-blue-600 hover:underline truncate">{{ userUrlFor(member.account.data, team.vm?.url)?.replace(/^https?:\/\//, '') }}</a>
                                    <button
                                        @click="copyToClipboard(userUrlFor(member.account.data, team.vm?.url) ?? '', 'vmurl-' + member.account.key)"
                                        class="text-gray-400 hover:text-amber-600 p-0.5 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
                                        :title="copiedKey === 'vmurl-' + member.account.key ? 'Kopiert!' : 'URL kopieren'">
                                        <component :is="copiedKey === 'vmurl-' + member.account.key ? Check : Copy" :size="12" />
                                    </button>
                                </div>
                                <div v-else-if="team.vm?.url"
                                    class="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border border-gray-100 max-w-[280px]">
                                    <span class="text-gray-400 font-sans text-[10px] uppercase tracking-wider flex-shrink-0">URL:</span>
                                    <a :href="team.vm.url" target="_blank" rel="noopener noreferrer"
                                        class="text-blue-600 hover:underline truncate">{{ team.vm.url.replace(/^https?:\/\//, '') }}</a>
                                    <button
                                        @click="copyToClipboard(team.vm.url, 'vmurl-' + member.account.key)"
                                        class="text-gray-400 hover:text-amber-600 p-0.5 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
                                        :title="copiedKey === 'vmurl-' + member.account.key ? 'Kopiert!' : 'URL kopieren'">
                                        <component :is="copiedKey === 'vmurl-' + member.account.key ? Check : Copy" :size="12" />
                                    </button>
                                </div>

                                <!-- Ready-to-use SSH command line — already
                                     includes username, IP and (for non-22) the port. -->
                                <div v-if="!team.vm?.url && member.account.data.ip && member.account.data.username && (!member.account.data.authtype || member.account.data.authtype === 'ssh')"
                                    class="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border border-gray-100 max-w-full">
                                    <span class="text-gray-400 font-sans text-[10px] uppercase tracking-wider flex-shrink-0">SSH:</span>
                                    <span class="truncate">{{ sshCommandFor(member.account.data) }}</span>
                                    <button
                                        @click="copyToClipboard(sshCommandFor(member.account.data), 'ssh-' + member.account.key)"
                                        class="text-gray-400 hover:text-amber-600 p-0.5 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
                                        :title="copiedKey === 'ssh-' + member.account.key ? 'Kopiert!' : 'SSH-Befehl kopieren'">
                                        <component :is="copiedKey === 'ssh-' + member.account.key ? Check : Copy" :size="12" />
                                    </button>
                                </div>

                                <div v-if="member.account.data.auth"
                                    class="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border border-gray-100 min-w-[150px] justify-between">
                                    <div class="truncate mr-1">
                                        <span
                                            class="text-gray-400 font-sans text-[10px] uppercase tracking-wider mr-1">PW:</span>
                                        <template v-if="visiblePasswords[member.account.key]">{{
                                            member.account.data.auth }}</template>
                                        <span v-else class="tracking-widest text-gray-400 select-none">••••••••</span>
                                    </div>

                                    <div class="flex items-center gap-0.5 flex-shrink-0">
                                        <button @click="togglePasswordVisibility(member.account.key)"
                                            class="text-gray-400 hover:text-gray-600 p-0.5 rounded hover:bg-gray-200 transition-colors">
                                            <component :is="visiblePasswords[member.account.key] ? EyeOff : Eye"
                                                :size="12" />
                                        </button>
                                        <button
                                            @click="copyToClipboard(member.account.data.auth, 'auth-' + member.account.key)"
                                            class="text-gray-400 hover:text-amber-600 p-0.5 rounded hover:bg-gray-200 transition-colors"
                                            :title="copiedKey === 'auth-' + member.account.key ? 'Kopiert!' : 'Passwort kopieren'">
                                            <component :is="copiedKey === 'auth-' + member.account.key ? Check : Copy"
                                                :size="12" />
                                        </button>
                                    </div>
                                </div>

                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Infrastructure — owner-only; the backend gates the underlying
             endpoint the same way, so members never mount it. -->
        <PodWorkloadsPanel
            v-if="isOwnerView && isPods"
            :workloads="workloads"
            :loading="resourcesLoading"
            :error="resourcesError"
            :live="workloadsLive"
            :can-act="canRedeploy"
            :busy="workloadBusy"
            @refresh="loadResources()"
            @restart="(w: string) => workloadAction(w, false)"
            @reset="askResetWorkload"
        />
        <DeploymentInfrastructurePanel
            v-else-if="isOwnerView"
            :can-redeploy="canRedeploy"
            :vm-resources="vmResources"
            :network-resources="networkResources"
            :security-resources="securityResources"
            :resources-loading="resourcesLoading"
            :resources-error="resourcesError"
            :redeploy-in-flight="redeployInFlight"
            :open-drawer-address="openDrawerAddress"
            @refresh="loadResources()"
            @open-vm="openVmDrawer"
            @redeploy-vm="redeployVm"
        />
        <!-- Tasks / Logs Section — history of finished tasks. The active
             task (if any) is rendered above in its own card, so the
             list filters it out to avoid double-rendering.
             Only the deployment owner / staff sees the actual task
             contents — members get a placeholder card instead so the
             page layout stays consistent across roles. -->
        <div v-if="!isOwnerView" class="detail-surface">
            <div class="flex items-center gap-3 mb-3">
                <div class="p-2 bg-gray-100 rounded-lg">
                    <Terminal :size="20" class="text-gray-400" />
                </div>
                <span class="text-lg font-semibold text-gray-700">{{ $t('DeploymentDetailView.tasksAndLogs') }}</span>
            </div>
            <div class="text-sm text-gray-500 flex items-start gap-2 px-2">
                <AlertCircle :size="16" class="text-gray-400 mt-0.5 flex-shrink-0" />
                <span>{{ $t('DeploymentDetailView.tasksOwnerOnly') }}</span>
            </div>
        </div>
        <div v-else class="detail-surface">
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-gray-100 rounded-lg">
                        <Terminal :size="20" class="text-gray-600" />
                    </div>
                    <span class="text-lg font-semibold text-gray-900">
                        {{ isStreamRelevant ? 'Task History' : 'Tasks & Logs' }}
                    </span>
                    <span v-if="historyTasks.length > 0"
                        class="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded">
                        {{ historyTasks.length }}
                    </span>
                </div>
                <button v-if="selectedTask" @click="deselectTask"
                    class="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors text-sm">
                    <CircleArrowLeft :size="16" />
                    <span>Back to list</span>
                </button>
            </div>

            <!-- Task List View -->
            <div v-if="!selectedTask">
                <div v-if="loadingTasks" class="flex justify-center py-10">
                    <Loader2 class="animate-spin text-primary" :size="32" />
                </div>

                <div v-else-if="historyTasks.length === 0" class="text-center py-10 text-gray-500">
                    {{ isStreamRelevant ? 'No previous tasks for this deployment.' : 'No tasks found' }}
                </div>

                <div v-else class="space-y-2">
                    <div v-for="task in historyTasks" :key="task.taskId" data-testid="task-row" @click="selectTask(task)"
                        class="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer border border-gray-200 hover:border-primary/30">
                        <div class="flex items-center gap-4 flex-1">
                            <component :is="getStatusStyles(task.status).icon" :size="18" :class="task.status === 'success' ? 'text-green-600' :
                                task.status === 'failed' ? 'text-red-600' :
                                    task.status === 'running' ? 'text-blue-600' : 'text-yellow-600'" />
                            <div class="flex-1">
                                <div class="flex items-center gap-3 mb-1">
                                    <span class="font-medium text-gray-900 capitalize">{{ task.type }}</span>
                                    <span
                                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border capitalize"
                                        :class="getStatusStyles(task.status).badgeClass">
                                        {{ task.status }}
                                    </span>
                                </div>
                                <div class="text-xs text-gray-500">
                                    Created: {{ formatDate(task.created_at) }}
                                </div>
                            </div>
                        </div>
                        <ChevronDown :size="20" class="text-gray-400 transform -rotate-90" />
                    </div>
                </div>
            </div>

            <!-- Task Detail View -->
            <div v-else class="space-y-4">
                <div v-if="loadingTaskDetail" class="flex justify-center py-10">
                    <Loader2 class="animate-spin text-primary" :size="32" />
                </div>

                <div v-else>
                    <div class="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-4">
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div>
                                <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Type</div>
                                <div class="text-sm font-medium text-gray-900 capitalize">{{ selectedTask.type }}</div>
                            </div>
                            <div>
                                <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Status</div>
                                <span
                                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border capitalize"
                                    :class="getStatusStyles(selectedTask.status).badgeClass">
                                    {{ selectedTask.status }}
                                </span>
                            </div>
                            <div>
                                <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Started</div>
                                <div class="text-sm text-gray-700">{{ formatDate(selectedTask.started_at) }}</div>
                            </div>
                            <div>
                                <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Finished</div>
                                <div class="text-sm text-gray-700">{{ formatDate(selectedTask.finished_at) }}</div>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 gap-3">
                            <div>
                                <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Task ID</div>
                                <div class="text-xs font-mono text-gray-700 bg-white px-2 py-1 rounded">{{
                                    selectedTask.taskId
                                }}</div>
                            </div>
                            <div>
                                <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Celery Task ID</div>
                                <div class="text-xs font-mono text-gray-700 bg-white px-2 py-1 rounded">{{
                                    selectedTask.celeryTaskId }}</div>
                            </div>
                            <div>
                                <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Created At</div>
                                <div class="text-sm text-gray-700">{{ formatDate(selectedTask.created_at) }}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Logs — same simple ``<pre>`` rendering as the
                         Terraform State and Outputs blocks below. The
                         previous formatted/raw toggle plus numbered
                         entry cards added a lot of UI surface for
                         little extra information; pretty-printed JSON
                         is uniform and lets the browser handle search
                         (Cmd+F) consistently across all three blocks. -->
                    <div v-if="selectedTask.logs" class="mb-4">
                        <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div
                                class="bg-gradient-to-r from-emerald-50 to-green-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <div class="p-1.5 bg-white rounded-md border border-emerald-200">
                                        <Terminal :size="16" class="text-emerald-600" />
                                    </div>
                                    <span class="font-semibold text-gray-900">Logs</span>
                                    <span v-if="logEntryCount !== null"
                                        class="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded border border-emerald-200">
                                        {{ logEntryCount }} entries
                                    </span>
                                </div>
                                <button @click="copyToClipboard(prettyJson(selectedTask.logs), 'logs')"
                                    :title="copiedKey === 'logs' ? 'Copied!' : 'Copy to clipboard'"
                                    class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors"
                                    :class="copiedKey === 'logs'
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'">
                                    <component :is="copiedKey === 'logs' ? Check : Copy" :size="13" />
                                    {{ copiedKey === 'logs' ? 'Copied' : 'Copy' }}
                                </button>
                            </div>
                            <div class="bg-gray-50 p-4 overflow-y-auto max-h-[500px]">
                                <div class="bg-white rounded-lg border border-gray-200 p-4">
                                    <!-- Failure case: for a backend-formatted
                                         ``Task failed: ...`` string, split the
                                         friendly headline (shown in red) from the
                                         technical trace, which hides behind a toggle. -->
                                    <template v-if="taskLogsSplit.isFailure">
                                        <div class="flex items-start gap-2 text-sm text-red-700 mb-3">
                                            <AlertCircle :size="18" class="mt-0.5 flex-shrink-0" />
                                            <div class="font-medium leading-relaxed whitespace-pre-wrap">{{ taskLogsSplit.headline }}</div>
                                        </div>
                                        <button
                                            v-if="taskLogsSplit.details"
                                            type="button"
                                            class="text-xs text-gray-600 hover:text-gray-900 underline mb-2"
                                            @click="showTaskLogsTrace = !showTaskLogsTrace"
                                        >
                                            {{ showTaskLogsTrace ? 'Technische Details ausblenden' : 'Technische Details anzeigen' }}
                                        </button>
                                        <pre
                                            v-if="showTaskLogsTrace && taskLogsSplit.details"
                                            class="text-gray-700 font-mono text-xs leading-relaxed whitespace-pre-wrap"
                                        >{{ taskLogsSplit.details }}</pre>
                                    </template>
                                    <!-- eslint-disable-next-line vue/no-v-html -- highlightJson escapes its input (utils/json-view.ts) -->
                                    <pre v-else class="text-gray-700 font-mono text-xs leading-relaxed whitespace-pre-wrap" v-html="highlightJson(prettyJson(selectedTask.logs))"></pre>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div v-else class="mb-4">
                        <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                <div class="flex items-center gap-2">
                                    <Terminal :size="16" class="text-gray-400" />
                                    <span class="font-semibold text-gray-700">Logs</span>
                                </div>
                            </div>
                            <div class="text-center py-8 text-gray-500">
                                <Terminal :size="32" class="mx-auto mb-2 text-gray-300" />
                                <p class="text-sm">No logs available for this task</p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>

            </div>
            <!--
                VM detail sidebar — sticky right column, rendered only when the
                user opened a VM. Stays in view while scrolling the main content
                and is clamped to the viewport height. Below ``xl`` it falls into
                the page flow as a normal-width card.
            -->
            <aside
                v-if="openDrawerAddress"
                class="w-full xl:w-[420px] xl:shrink-0 xl:sticky xl:top-0 xl:self-start xl:max-h-[calc(100vh-3.5rem)] xl:flex xl:flex-col"
            >
                <InfrastructureVmDrawer
                    :deployment-id="deploymentId"
                    :address="openDrawerAddress"
                    class="xl:flex-1 xl:min-h-0"
                    @close="closeVmDrawer"
                />
            </aside>
        </div>

        <!-- Delete Confirmation Modal -->
        <!-- Stop Confirmation Modal. Worth a confirm: cancelling throws
             away an in-flight build that may be 20 minutes in. -->
        <Modal :show="showCancelModal" @close="showCancelModal = false">
            <template #title>
                {{ $t('DeploymentDetailView.confirmStopTitle') }}
            </template>
            <template #body>
                <i18n-t :keypath="isPods ? 'DeploymentDetailView.confirmStopMessagePods' : 'DeploymentDetailView.confirmStopMessage'" tag="p" class="text-gray-700">
                    <template #name><strong>{{ deployment.name }}</strong></template>
                </i18n-t>
            </template>
            <template #footer>
                <div class="flex justify-end gap-3">
                    <BaseButton variant="text" @click="showCancelModal = false">
                        {{ $t('DeploymentDetailView.cancelButton') }}
                    </BaseButton>
                    <BaseButton variant="primary" :disabled="cancelBusy" @click="confirmCancel">
                        {{ $t('DeploymentDetailView.confirmButton') }}
                    </BaseButton>
                </div>
            </template>
        </Modal>

        <Modal :show="showDeleteModal" @close="showDeleteModal = false">
            <template #title>
                {{ $t('DeploymentDetailView.confirmDeleteTitle') }}
            </template>
            <template #body>
                <i18n-t :keypath="isPods ? 'DeploymentDetailView.confirmDeleteMessagePods' : 'DeploymentDetailView.confirmDeleteMessage'" tag="p" class="text-gray-700">
                    <template #name><strong>{{ deployment.name }}</strong></template>
                </i18n-t>
            </template>
            <template #footer>
                <div class="flex justify-end gap-3">
                    <BaseButton variant="text" @click="showDeleteModal = false">
                        {{ $t('DeploymentDetailView.cancelButton') }}
                    </BaseButton>
                    <BaseButton variant="destructive" data-testid="btn-confirm-delete" @click="confirmDelete">
                        {{ $t('DeploymentDetailView.confirmButton') }}
                    </BaseButton>
                </div>
            </template>
        </Modal>

        <!-- Redeploy Confirmation Modal — same shape as Delete: a
             yellow Cancel and a red Confirm. We surface the VM
             address in the body so the user can sanity-check which
             instance they're about to recreate. The Modal is the
             single source of truth; we never fall back to
             ``window.confirm``. -->
        <Modal :show="showRedeployModal" @close="showRedeployModal = false">
            <template #title>
                {{ $t('DeploymentDetailView.confirmRedeployTitle') }}
            </template>
            <template #body>
                <div class="space-y-3">
                    <p class="text-gray-700">
                        {{ $t('DeploymentDetailView.confirmRedeployMessage') }}
                    </p>
                    <p v-if="redeployTargetAddress" class="text-xs font-mono text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 break-all">
                        {{ redeployTargetAddress }}
                    </p>
                </div>
            </template>
            <template #footer>
                <div class="flex justify-end gap-3">
                    <BaseButton variant="text" @click="showRedeployModal = false">
                        {{ $t('DeploymentDetailView.cancelButton') }}
                    </BaseButton>
                    <BaseButton variant="destructive" @click="confirmRedeploy">
                        {{ $t('vm.actions.redeploy') }}
                    </BaseButton>
                </div>
            </template>
        </Modal>

        <!-- Reset one pod workload: its volume (the data) is deleted. -->
        <Modal :show="showResetModal" @close="showResetModal = false">
            <template #title>
                {{ $t('pods.confirmResetTitle') }}
            </template>
            <template #body>
                <i18n-t keypath="pods.confirmResetMessage" tag="p" class="text-gray-700">
                    <template #workload><strong class="font-mono">{{ resetTargetWorkload }}</strong></template>
                </i18n-t>
            </template>
            <template #footer>
                <div class="flex justify-end gap-3">
                    <BaseButton variant="text" @click="showResetModal = false">
                        {{ $t('DeploymentDetailView.cancelButton') }}
                    </BaseButton>
                    <BaseButton variant="destructive" data-testid="btn-confirm-reset" @click="confirmResetWorkload">
                        {{ $t('pods.reset') }}
                    </BaseButton>
                </div>
            </template>
        </Modal>

        <!-- Pause / Resume confirm. Same pattern as Delete: a tiny
             modal that asks the user to confirm before we POST. The
             title/body switch on ``pauseResumeAction`` so we don't
             render two near-identical modals. -->
        <Modal :show="showPauseResumeModal" @close="showPauseResumeModal = false">
            <template #title>
                {{ pauseResumeAction === 'pause'
                    ? $t('DeploymentDetailView.confirmPauseTitle')
                    : $t('DeploymentDetailView.confirmResumeTitle') }}
            </template>
            <template #body>
                <i18n-t
                    :keypath="pauseResumeAction === 'pause'
                        ? (isPods ? 'DeploymentDetailView.confirmPauseMessagePods' : 'DeploymentDetailView.confirmPauseMessage')
                        : (isPods ? 'DeploymentDetailView.confirmResumeMessagePods' : 'DeploymentDetailView.confirmResumeMessage')"
                    tag="p"
                    class="text-gray-700"
                >
                    <template #name><strong>{{ deployment.name }}</strong></template>
                </i18n-t>
            </template>
            <template #footer>
                <div class="flex justify-end gap-3">
                    <BaseButton variant="text" @click="showPauseResumeModal = false">
                        {{ $t('DeploymentDetailView.cancelButton') }}
                    </BaseButton>
                    <BaseButton
                        :variant="pauseResumeAction === 'pause' ? 'primary' : 'secondary'"
                        @click="confirmPauseResume"
                        :disabled="pauseResumeBusy">
                        {{ pauseResumeAction === 'pause'
                            ? $t('DeploymentDetailView.deploymentPause')
                            : $t('DeploymentDetailView.deploymentResume') }}
                    </BaseButton>
                </div>
            </template>
        </Modal>
    </div>

    <!-- Loading State -->
    <div v-else class="flex items-center justify-center py-20">
        <Loader2 class="animate-spin text-primary" :size="40" />
    </div>
</template>