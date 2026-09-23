<script lang="ts" setup>
import { CircleArrowLeft, Loader2, Users, Settings, Terminal, ChevronDown, Trash2, GitBranch, User, Calendar, Clock, Package, AlertCircle, CheckCircle, XCircle, StopCircle, Flame, Copy, Check, Send, PauseCircle, PlayCircle, RefreshCw, Server, Network, Shield } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import Modal from '@/components/ui/Modal.vue'
import { useRoute, useRouter } from 'vue-router'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useAuthStore } from '@/stores/auth.store'
import { useRole } from '@/composables/useRole'
import { useToastStore } from '@/stores/toast.store'
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { taskApi } from '@/api/task.api'
import { deploymentApi } from '@/api/deployment.api'
import type { Task, DeploymentResource } from '@/types'
import { useDeploymentStream } from '@/composables/useDeploymentStream'
import InfrastructureVmCard from '@/components/InfrastructureVmCard.vue'
import InfrastructureVmDrawer from '@/components/InfrastructureVmDrawer.vue'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import { formatDateTime } from '@/utils/format'
import { extractErrorMessage } from '@/utils/http-error'

import { Eye, EyeOff } from 'lucide-vue-next'

// Password visibility state, keyed by account index/key.
const visiblePasswords = ref<Record<string | number, boolean>>({})

const togglePasswordVisibility = (key: string | number) => {
    visiblePasswords.value[key] = !visiblePasswords.value[key]
}

// Build a copy-paste SSH command from an account. Skips ``-p`` for the
// default port 22 so the line stays short for the common case.
const sshCommandFor = (data: { username?: string; ip?: string; port?: number }): string => {
    if (!data.username || !data.ip) return ''
    const portFlag = data.port && data.port !== 22 ? `-p ${data.port} ` : ''
    return `ssh ${portFlag}${data.username}@${data.ip}`
}

// Wrap a bare IPv6 literal in brackets so it can be embedded in a
// host:port string. IPv4 and hostnames pass through untouched.
const bracketHost = (ip: string): string => (ip.includes(':') ? `[${ip}]` : ip)

// Build a copy-paste RDP command from an account. Windows apps opt in by
// publishing ``authtype: "rdp"``; only those reach this helper, so apps
// that predate it keep their existing URL / SSH rendering unchanged.
// ``mstsc`` needs the IPv6 literal bracketed, hence ``bracketHost``.
const rdpCommandFor = (data: { username?: string; ip?: string; port?: number }): string => {
    if (!data.ip) return ''
    return `mstsc /v:${bracketHost(data.ip)}:${data.port ?? 3389}`
}

// Build a per-user URL from user_accounts (ip + port), preserving any path
// suffix the team VM url carries (e.g. "/pgadmin4").
const userUrlFor = (data: { ip?: string; port?: number }, teamVmUrl?: string): string | null => {
    if (!data.ip || !data.port) return null
    let path = ''
    if (teamVmUrl) {
        try {
            path = new URL(teamVmUrl).pathname.replace(/\/$/, '')
        } catch { /* ignore malformed url */ }
    }
    return `http://${data.ip}:${data.port}${path}`
}


const route = useRoute()
const router = useRouter()
const deploymentStore = useDeploymentStore()
const authStore = useAuthStore()
const { isStaff } = useRole()
const toastStore = useToastStore()
const { t } = useI18n()
const tasks = ref<Task[]>([])
const loadingTasks = ref(false)
const selectedTask = ref<Task | null>(null)
const latestTaskOutputs = ref<Task | null>(null)
// Member self-access: a non-owner (student) can't read the owner-only
// task outputs, so we fetch just their own credentials from the
// dedicated ``/my-access`` endpoint into this map. It mirrors the raw
// ``user_accounts.value`` shape so ``typedUserAccounts`` can fall back
// to it and the existing account-matching pipeline works unchanged.
const myAccounts = ref<Record<string, UserAccount> | null>(null)
const myTeamVms = ref<Record<string, { url?: string; floating_ip?: string; fixed_ip?: string }> | null>(null)
// Always returns the currently active data task for the UI blocks.
const activeDataTask = computed(() => selectedTask.value || latestTaskOutputs.value)
const loadingTaskDetail = ref(false)

const deploymentId = route.params.id as string

const deployment = computed(() => deploymentStore.currentDeployment)
// Structure of a single account.
interface UserAccount {
    username: string
    team: string
    ip: string
    port: number
    auth: string
    type?: 'password' | 'ssh_key' | 'oauth' | 'none' | string
    authtype?: 'ssh' | 'url' | 'rdp' | string
    url?: string
}

const typedUserAccounts = computed<Record<string, UserAccount> | null>(() => {
    const currentTarget = selectedTask.value || latestTaskOutputs.value
    const rawOutputs = currentTarget?.outputs
    // Member fallback: non-owners have no task outputs (the owner-only
    // task endpoint 403s / is skipped), so use the per-user credentials
    // fetched from ``/my-access``. Already in the ``user_accounts.value``
    // shape, so it feeds the matching pipeline below directly.
    if (!rawOutputs) return myAccounts.value

    let outputsObj: any = rawOutputs

    // Case 1: outputs arrive as a JSON string from the DB text column.
    if (typeof rawOutputs === 'string') {
        try {
            const trimmed = rawOutputs.trim()
            if (trimmed.startsWith('{')) {
                outputsObj = JSON.parse(trimmed)
            }
        } catch (e) {
            console.error('Failed to parse raw outputs data:', e)
            return myAccounts.value
        }
    }

    // Case 2: it is already an object (or was parsed successfully above).
    if (outputsObj && typeof outputsObj === 'object' && 'user_accounts' in outputsObj) {
        const userAccountsContainer = outputsObj.user_accounts

        // Reach through to the Terraform ``.value`` object.
        if (userAccountsContainer && userAccountsContainer.value) {
            return userAccountsContainer.value as Record<string, UserAccount>
        }
    }

    return myAccounts.value
})



const enrichedTeams = computed(() => {
    const currentDeployment = deployment && 'value' in deployment
        ? deployment.value
        : deployment;

    if (!currentDeployment?.teams) return [];

    const accounts = typedUserAccounts && 'value' in typedUserAccounts
        ? typedUserAccounts.value
        : typedUserAccounts;

    // Team-level VM metadata from terraform's ``team_vms`` output. Apps
    // that serve a Web-UI publish ``url`` here; SSH-only apps don't.
    // We surface that as ``team.vm`` so the template can decide between
    // a URL pill and an SSH-command pill per team.
    const teamVms = extractTeamVms()

    // Resolve member ↔ account.
    //
    // The canonical contract is the ``user_accounts`` MAP KEY, which every app
    // template constructs the same way:
    //
    //     key = "<team>-" + email.split("@")[0].replace(".", "-")
    //
    // Since the member's email and team are known here, that key can be
    // reproduced deterministically. The value's ``username`` field is not a
    // reliable identifier (some templates write the email local-part, others a
    // shared team-wide pseudo-email), so we index by key and look up the derived
    // key per member. Three fallbacks cover templates not matched by the key.
    const accountByEmail = new Map<string, { key: string; data: UserAccount }>()
    const accountByUsername = new Map<string, { key: string; data: UserAccount }>()
    const accountByKey = new Map<string, { key: string; data: UserAccount }>()
    if (accounts) {
        for (const [key, acc] of Object.entries(accounts)) {
            const candidate = acc?.username?.trim().toLowerCase()
            if (candidate && candidate.includes('@')) {
                accountByEmail.set(candidate, { key, data: acc })
            } else if (candidate) {
                accountByUsername.set(candidate, { key, data: acc })
            }
            accountByKey.set(key.trim().toLowerCase(), { key, data: acc })
        }
    }

    // Mirror the terraform key sanitisation: lowercase the local-part
    // and replace dots with dashes. Only dots — terraform's
    // ``replace(local_part, ".", "-")`` does not touch other characters.
    const deriveExpectedKey = (teamName: string, email: string | undefined): string | null => {
        if (!email) return null
        const localPart = email.split('@')[0]
        if (!localPart) return null
        const sanitised = localPart.replace(/\./g, '-').toLowerCase()
        return `${teamName.trim().toLowerCase()}-${sanitised}`
    }

    return currentDeployment.teams.map(team => {
        const vm = teamVms?.[team.name] ?? null
        const teamNameLower = team.name.trim().toLowerCase()
        return {
            ...team,
            vm,
            members: team.members.map(member => {
                const memberEmail = member?.email?.trim().toLowerCase()
                const memberName = member?.username?.trim().toLowerCase()

                // Strategy 0 (canonical): derive the terraform key from
                // member.email + team.name and look it up directly.
                let hit: { key: string; data: UserAccount } | undefined
                const expectedKey = deriveExpectedKey(team.name, memberEmail)
                if (expectedKey) hit = accountByKey.get(expectedKey)

                // Strategy 1: email-based (templates that write the
                // member's full email into ``account.username``).
                if (!hit && memberEmail) hit = accountByEmail.get(memberEmail)

                // Strategy 2: username substring against account.username
                if (!hit && memberName) {
                    for (const [accUser, entry] of accountByUsername) {
                        if (accUser.includes(memberName) || memberName.includes(accUser)) {
                            hit = entry
                            break
                        }
                    }
                }

                // Strategy 3: username substring against the account key
                // (``Team #1-leon-priemer`` etc.). Last-resort fallback
                // for templates where ``account.username`` is missing
                // and the keycloak username happens to match the slug.
                if (!hit && memberName) {
                    for (const [accKey, entry] of accountByKey) {
                        if (accKey.includes(memberName)) {
                            hit = entry
                            break
                        }
                    }
                }

                // Team scope guard so an account from team A can't be
                // attached to a member of team B.
                const accountTeam = hit?.data.team?.trim().toLowerCase()
                const keyLower = hit?.key.trim().toLowerCase()
                const teamMatches = hit && (
                    accountTeam === teamNameLower ||
                    (keyLower?.startsWith(`${teamNameLower}-`) ?? false) ||
                    (keyLower?.includes(teamNameLower) ?? false)
                )
                return {
                    ...member,
                    account: teamMatches ? hit : null
                };
            })
        };
    });
});

/**
 * Pull the ``team_vms`` object out of the active task's outputs. Same
 * unwrap chain as ``typedUserAccounts`` — the outputs may arrive as a
 * raw JSON string from the DB or as an already-parsed object, and the
 * actual map sits under ``.value`` because Terraform stamps the output
 * shape on the wrapper. Returns ``null`` if anything along the way
 * isn't there.
 */
function extractTeamVms(): Record<string, { url?: string; floating_ip?: string; fixed_ip?: string }> | null {
    const currentTarget = selectedTask.value || latestTaskOutputs.value
    const rawOutputs = currentTarget?.outputs
    // Member fallback: use the team VM block from ``/my-access`` so a
    // non-owner still gets the Web-URL pill (SSH/PW render even without it).
    if (!rawOutputs) return myTeamVms.value

    let outputsObj: any = rawOutputs
    if (typeof rawOutputs === 'string') {
        try {
            const trimmed = rawOutputs.trim()
            if (trimmed.startsWith('{')) outputsObj = JSON.parse(trimmed)
        } catch {
            return myTeamVms.value
        }
    }
    const vms = outputsObj?.team_vms?.value
    return vms && typeof vms === 'object' ? vms : myTeamVms.value
}

// Counts the resources in the state for the header sub-headline.
const tfResourcesCount = computed(() => {
    const state = selectedTask.value?.tf_state
    if (!state) return 0

    try {
        const parsed = typeof state === 'string' ? JSON.parse(state) : state
        return parsed?.resources?.length || 0
    } catch {
        return 0
    }
})

// Lightweight, safe syntax highlighting for JSON.
const highlightJson = (jsonString: string): string => {
    if (!jsonString) return ''

    let safeStr = jsonString
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

    return safeStr.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
        (match) => {
            let cls = 'text-amber-400'

            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'text-blue-500 font-medium' // keys
                } else {
                    cls = 'text-emerald-500' // string values
                }
            } else if (/true|false/.test(match)) {
                cls = 'text-purple-500 font-bold' // booleans
            } else if (/null/.test(match)) {
                cls = 'text-gray-500 italic' // null
            } else {
                cls = 'text-cyan-500' // numbers
            }

            return `<span class="${cls}">${match}</span>`
        }
    )
}

// Owner-view vs member-view — mirrors backend/app/utils/permissions.py
// ``is_deployment_owner_view``. Drives every gated UI element on
// this page: tasks/logs sections, terraform-state/outputs blocks,
// the Delete button, the SSE live-stream connection, and the
// resend-credentials buttons of *other* members in the same team.
//
// We trust the backend on the source-of-truth side (it returns 403
// or filters data when the caller isn't owner-view); this computed
// just hides the affordances so the user doesn't see buttons that
// would 403 on click.
const isOwnerView = computed(() => {
    if (isStaff.value) return true
    const ownerId = deployment.value?.userId
    return !!ownerId && String(ownerId) === String(authStore.userId)
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

const loadResources = async (refresh = true) => {
    if (!isOwnerView.value) return
    resourcesLoading.value = true
    resourcesError.value = null
    try {
        const response = await deploymentApi.listResources(deploymentId, { refresh })
        resources.value = response.data.resources
    } catch (err: any) {
        const status = err?.response?.status
        if (status === 412) {
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
        toastStore.success(`Redeploy gestartet für ${address}`)
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
        const detail = err?.response?.data?.detail
        const reason = detail?.reason
        if (reason === 'non_redeployable_resource_type') {
            toastStore.error('Nur Compute-Instanzen können einzeln redeployed werden.')
        } else if (reason === 'resource_not_in_state') {
            toastStore.error('Diese Resource ist nicht mehr im aktuellen State.')
        } else if (err?.response?.status === 409) {
            toastStore.error('Es läuft bereits eine Lifecycle-Aktion für dieses Deployment.')
        } else {
            toastStore.error(err?.message || 'Redeploy fehlgeschlagen.')
        }
    }
}

// Lifecycle action gating — the action bar exposes Delete plus a
// dynamic Pause/Resume button. The backend picks the right Delete
// behaviour (terraform destroy + soft-delete vs. straight soft-delete)
// based on status, so the frontend just surfaces availability.
// Mirrors backend/app/services/lifecycle.py:
//   * success                 → Delete (dispatches Destroy), Pause
//   * paused                  → Delete (dispatches Destroy), Resume
//   * pause_failed            → Delete, Pause-Retry, Resume
//   * resume_failed           → Delete, Resume-Retry, Pause
//   * failed                  → Delete (Destroy or soft-delete)
//   * cancelled               → Delete (soft-delete)
//   * pending / running / destroying / pausing / resuming → 409, all disabled
//
// Members can never act on lifecycle; the action-bar hides the
// buttons entirely for them rather than rendering permanently-disabled
// controls.
const DELETE_STATUSES = [
  'success', 'failed', 'cancelled', 'paused', 'pause_failed', 'resume_failed',
]

// Cancel is the only action offered while a deploy is still in flight.
// The backend enforces the same rule; this just keeps the button from
// appearing when it would only earn a 409.
const CANCEL_STATUSES = ['pending', 'running']

const canCancel = computed(() => {
    if (!isOwnerView.value) return false
    return CANCEL_STATUSES.includes(deployment.value?.status ?? '')
})

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
    } catch (err: any) {
        toastStore.addToast({
            type: 'error',
            message: err.response?.data?.detail || t('DeploymentDetailView.stopFailedToast'),
        })
    } finally {
        cancelBusy.value = false
    }
}

const showCancelModal = ref(false)

const canDelete = computed(() => {
    if (!isOwnerView.value) return false
    return DELETE_STATUSES.includes(deployment.value?.status ?? '')
})

const deleteDisabledReason = computed(() => {
    if (canDelete.value) return ''
    return `Delete available when status is ${DELETE_STATUSES.join(', ')}`
})

// One Pause/Resume button — what it does depends on status. Most
// common case: ``success`` → Pause; ``paused`` → Resume. Failure
// states (pause_failed / resume_failed) also expose a retry that
// matches what just broke. Anything else hides it entirely.
const canPause = computed(() => {
    if (!isOwnerView.value) return false
    const s = deployment.value?.status
    return s === 'success' || s === 'pause_failed' || s === 'resume_failed'
})
const canResume = computed(() => {
    if (!isOwnerView.value) return false
    const s = deployment.value?.status
    return s === 'paused' || s === 'pause_failed' || s === 'resume_failed'
})
const canPauseOrResume = computed(() => canPause.value || canResume.value)
const pauseResumeAction = computed<'pause' | 'resume' | null>(() => {
    // Prefer the action that matches the steady-state semantic of
    // the current status: from ``success`` we pause, from ``paused``
    // we resume. From the failure states we pick the retry that
    // matches what just broke.
    const s = deployment.value?.status
    if (s === 'success' || s === 'pause_failed') return 'pause'
    if (s === 'paused' || s === 'resume_failed') return 'resume'
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
    await loadTasks() // Loads the history into tasks.value

    if (isOwnerView.value) {
        // Owner view: seed the top outputs from the latest task so the
        // page can render the summary before the first SSE event arrives.
        if (tasks.value && tasks.value.length > 0) {
            const sortedTasks = [...tasks.value].sort((a, b) =>
                b.created_at.localeCompare(a.created_at)
            )

            const latestTask = sortedTasks[0]

            if (latestTask) {
                // Fetch the details straight from the API into latestTaskOutputs.
                try {
                    const { data } = await taskApi.getById(latestTask.taskId)
                    latestTaskOutputs.value = data
                } catch (err) {
                    console.error('Error seeding top outputs:', err)
                }
            }
        }
    } else {
        // Member view: the owner-only task outputs are off-limits, so
        // fetch just this member's own credentials from ``/my-access``.
        // ``typedUserAccounts`` / ``extractTeamVms`` fall back to these,
        // and the Teams-card credential block renders as for the owner.
        try {
            const { data } = await deploymentApi.getMyAccess(deploymentId)
            // The API type marks fields optional; the local UserAccount
            // interface is stricter but structurally compatible at the
            // point of use, so cast the map through unknown.
            myAccounts.value = (data.user_accounts ?? null) as Record<string, UserAccount> | null
            myTeamVms.value = data.team_vms ?? null
        } catch (err) {
            console.error('Error loading own access credentials:', err)
        }
    }

    // Fire the resource load in parallel — it's a separate roundtrip
    // (OpenStack live-fetch can take ~1s) and the page should render
    // its other panels while it's in flight.
    loadResources()
})

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

// True while the deployment (or its active task) is still moving. The
// resend-access button reads this to stay disabled until the run is
// terminal — otherwise an operator could mail credentials before the
// VMs/services they point at are reachable.
const isDeploymentBusy = computed(() => {
    const dStatus = deployment.value?.status
    if (dStatus === 'pending' || dStatus === 'running') return true
    const tStatus = activeTask.value?.status
    if (tStatus === 'pending' || tStatus === 'running') return true
    // Members never load the task list (tasks.value stays empty, so
    // activeTask is null), but a redeploy/pause/resume can still be in
    // flight while the deployment row reads "success". Fall back to the
    // latest_task status from the detail response, which is populated
    // regardless of role, so the member's resend button stays disabled
    // until the run is terminal.
    const latestStatus = deployment.value?.latest_task?.status
    return latestStatus === 'pending' || latestStatus === 'running'
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

// Phase stepper — N dots based on the live ``totalPhases`` reported by the
// worker. Phase names live in the worker (different sets for deploy/destroy),
// so the frontend stays task-type-agnostic for the dot count. Label tables for
// the deploy/destroy presets render meaningful labels under each dot when the
// totals match a known shape; an unknown count falls back to numbered labels.
//
// Default to a conservative 11-dot view before the first event arrives so the
// layout doesn't jump when the worker reports its real phase count.
const DEFAULT_PHASE_COUNT = 11

const PHASE_LABELS_DEPLOY_FULL = [
    'STARTING',
    'OPENSTACK_SETUP',
    'GIT_CLONE',
    'CREDS_MATERIALISE',
    'PACKER_INIT',
    'PACKER_VALIDATE',
    'PACKER_BUILD',
    'TERRAFORM_INIT',
    'TERRAFORM_PLAN',
    'TERRAFORM_APPLY',
    'OUTPUTS_AND_CLEANUP',
] as const

const PHASE_LABELS_DEPLOY_NO_PACKER = [
    'STARTING',
    'OPENSTACK_SETUP',
    'GIT_CLONE',
    'CREDS_MATERIALISE',
    'TERRAFORM_INIT',
    'TERRAFORM_PLAN',
    'TERRAFORM_APPLY',
    'OUTPUTS_AND_CLEANUP',
] as const

const PHASE_LABELS_DESTROY = [
    'STARTING',
    'OPENSTACK_SETUP',
    'GIT_CLONE',
    'CREDS_MATERIALISE',
    'TERRAFORM_INIT',
    'TERRAFORM_DESTROY',
    'CLEANUP',
] as const

// Pause/Resume share the destroy preamble (clone + clouds + tf init to allow a
// state-pull) but their hot phase is a CLI-driven server stop/start, not a
// terraform destroy. Same length as ``PHASE_LABELS_DESTROY`` (7), so tables are
// picked by task type first and only fall back to length-matching when the type
// is unknown (e.g. live-stream attached before tasks were loaded).
const PHASE_LABELS_PAUSE = [
    'STARTING',
    'OPENSTACK_SETUP',
    'GIT_CLONE',
    'CREDS_MATERIALISE',
    'TERRAFORM_INIT',
    'SERVER_STOP',
    'CLEANUP',
] as const

const PHASE_LABELS_RESUME = [
    'STARTING',
    'OPENSTACK_SETUP',
    'GIT_CLONE',
    'CREDS_MATERIALISE',
    'TERRAFORM_INIT',
    'SERVER_START',
    'CLEANUP',
] as const

// Per-VM redeploy reuses the destroy preamble (clone, clouds.yaml,
// init) and then runs ``terraform apply -replace=… -target=…`` for
// the single targeted resource. Phase shape mirrors
// ``worker/app/tasks.py:_PHASES_REDEPLOY``.
const PHASE_LABELS_REDEPLOY = [
    'STARTING',
    'OPENSTACK_SETUP',
    'GIT_CLONE',
    'CREDS_MATERIALISE',
    'TERRAFORM_INIT',
    'TERRAFORM_APPLY',
    'CLEANUP',
] as const

// Stepper labels: the worker sends the full phase sequence as ``phase_names``
// with every progress event — the authoritative source, since multi-image
// deploys have a dynamic sequence whose template keys the frontend can't guess.
// Before the first progress event, we fall back to the static tables below,
// which cover the fixed shapes (single-image deploy / destroy / pause / resume
// / redeploy); multi-image slots show generic numbers until ``phase_names`` lands.

const phaseStepCount = computed<number>(() => {
    return streamTotalPhases.value > 0 ? streamTotalPhases.value : DEFAULT_PHASE_COUNT
})

// Return the label for a given 0-based index. Order of precedence:
//   1. ``streamPhaseNames`` — authoritative, ships from the worker on
//      every progress event for every real task (deploy / destroy /
//      pause / resume / redeploy). Contains the exact phase names
//      including ``:<template_key>`` suffixes for multi-image builds.
//   2. Static table picked by ``activeTask.type`` — used in the brief
//      window between page-load and the first progress event, and
//      always for legacy Single-Image-Deploy where the worker's
//      sequence is byte-identical to ``PHASE_LABELS_DEPLOY_FULL``.
//   3. Numeric slot index — empty-slot guard so the stepper height
//      doesn't collapse during the loading flicker.
const phaseStepLabel = (idx: number): string => {
    // 1. Worker-authoritative list.
    const fromStream = streamPhaseNames.value
    if (Array.isArray(fromStream) && idx >= 0 && idx < fromStream.length) {
        return phaseLabel(fromStream[idx])
    }

    // 2. Static fallback by active task type. Used until the first
    //    progress event lands.
    let table: readonly string[] | null = null
    const activeType = activeTask.value?.type
    if (activeType === 'pause') {
        table = PHASE_LABELS_PAUSE
    } else if (activeType === 'resume') {
        table = PHASE_LABELS_RESUME
    } else if (activeType === 'destroy') {
        table = PHASE_LABELS_DESTROY
    } else if (activeType === 'redeploy') {
        table = PHASE_LABELS_REDEPLOY
    } else if (activeType === 'deploy') {
        // Without the worker's ``phase_names`` we can't tell legacy
        // (11) apart from multi-image (14, 17, ...). The total is
        // already known from the stream though, so pick the matching
        // table when it fits exactly — otherwise leave ``table = null``
        // and let the loop fall through to numeric slot indices.
        // Once the first progress event arrives, ``phase_names`` takes
        // over and the predicted slots are replaced with real labels.
        if (streamTotalPhases.value === PHASE_LABELS_DEPLOY_NO_PACKER.length) {
            table = PHASE_LABELS_DEPLOY_NO_PACKER
        } else if (streamTotalPhases.value === PHASE_LABELS_DEPLOY_FULL.length) {
            table = PHASE_LABELS_DEPLOY_FULL
        }
    }
    // Length-based last resort (no active task type known yet).
    if (!table) {
        const total = streamTotalPhases.value
        if (total === PHASE_LABELS_DEPLOY_FULL.length) table = PHASE_LABELS_DEPLOY_FULL
        else if (total === PHASE_LABELS_DEPLOY_NO_PACKER.length) table = PHASE_LABELS_DEPLOY_NO_PACKER
        else if (total === PHASE_LABELS_DESTROY.length) table = PHASE_LABELS_DESTROY
    }
    if (table && idx >= 0 && idx < table.length) {
        return phaseLabel(table[idx])
    }
    // 3. Numeric placeholder so the slot has a non-empty label.
    return String(idx + 1)
}

// 0-based index of the active dot. Prefer the worker's authoritative
// ``phase_index`` (1-based) from the SSE payload — only fall back to
// rounding ``progress_pct`` if no progress event has arrived yet.
const currentPhaseIndex = computed<number>(() => {
    if (streamCurrentPhaseIndex.value !== null && streamCurrentPhaseIndex.value > 0) {
        return streamCurrentPhaseIndex.value - 1
    }
    if (streamProgress.value === null) return -1
    const total = phaseStepCount.value
    const pct = Math.max(0, Math.min(100, streamProgress.value))
    return Math.max(0, Math.min(total - 1, Math.round((pct / 100) * total) - 1))
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
            // logs/outputs land in the static rendering below.
            loadTasks()
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
const prettyJson = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value, null, 2)
        } catch {
            return String(value)
        }
    }
    if (typeof value === 'string') {
        const trimmed = value.trim()
        // Cheap pre-check: only attempt JSON.parse on strings that look
        // like JSON. Saves a try/catch round-trip for ordinary log
        // text and avoids accidentally parsing a bare number or "null"
        // string into something the consumer didn't expect.
        if (
            (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))
        ) {
            try {
                return JSON.stringify(JSON.parse(trimmed), null, 2)
            } catch {
                return value
            }
        }
        return value
    }
    return String(value)
}

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

const phaseLabel = (phase: unknown): string => {
    if (typeof phase !== 'string' || !phase) return ''
    // Worker-emitted multi-image phases carry the template key as a ``:<key>``
    // suffix (e.g. ``PACKER_BUILD:database``). Split the suffix off, title-case
    // the base name, and append the sub-key as ``[<key>]`` so the stepper reads
    // ``Packer Build [database]`` instead of ``Packer Build:database``.
    const colonIdx = phase.indexOf(':')
    const base = colonIdx === -1 ? phase : phase.slice(0, colonIdx)
    const subKey = colonIdx === -1 ? '' : phase.slice(colonIdx + 1).trim()
    const formattedBase = base
        .split('_')
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ')
    return subKey ? `${formattedBase} [${subKey}]` : formattedBase
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
                dotClass: 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]',
                textClass: 'text-gray-900',
                badgeClass: 'bg-green-100 text-green-800 border-green-300',
                icon: CheckCircle
            }
        case 'running':
            return {
                label: 'DeploymentsView.deploymentRunning',
                dotClass: 'bg-blue-500 animate-pulse shadow-[0_0_12px_rgba(59,130,246,0.6)]',
                textClass: 'text-gray-900',
                badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
                icon: Loader2
            }
        case 'pending':
            return {
                label: 'DeploymentsView.deploymentPending',
                dotClass: 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.4)]',
                textClass: 'text-gray-900',
                badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-300',
                icon: Clock
            }
        case 'failed':
            return {
                label: 'DeploymentsView.deploymentFailed',
                dotClass: 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]',
                textClass: 'text-gray-900',
                badgeClass: 'bg-red-100 text-red-800 border-red-300',
                icon: XCircle
            }
        case 'destroying':
            return {
                label: 'DeploymentsView.deploymentDestroying',
                dotClass: 'bg-orange-500 animate-pulse shadow-[0_0_12px_rgba(249,115,22,0.6)]',
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
                dotClass: 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]',
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
                dotClass: 'bg-amber-500 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.6)]',
                textClass: 'text-gray-900',
                badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
                icon: Loader2
            }
        case 'paused':
            return {
                label: 'DeploymentsView.deploymentPaused',
                dotClass: 'bg-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.4)]',
                textClass: 'text-gray-900',
                badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
                icon: PauseCircle
            }
        case 'resuming':
            return {
                label: 'DeploymentsView.deploymentResuming',
                dotClass: 'bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.6)]',
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
                dotClass: 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]',
                textClass: 'text-gray-900',
                badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
                icon: AlertCircle
            }
        case 'resume_failed':
            return {
                label: 'DeploymentsView.deploymentResumeFailed',
                dotClass: 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]',
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
            message: `${t('DeploymentDetailView.deleteErrorToast')}: ` + extractErrorMessage(err),
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
                + extractErrorMessage(err),
        })
    } finally {
        pauseResumeBusy.value = false
        showPauseResumeModal.value = false
    }
}

// Per-user resend-access state. Map ``userId → 'sending' | 'sent' | 'error'``
// so the button can show inline feedback on the row that was clicked
// without forcing a re-render of the whole list. The 'sent' state
// auto-clears after 2s so the user can resend again.
const resendState = ref<Record<string, 'sending' | 'sent' | 'error'>>({})

const resendAccess = async (teamId: string, userId: string) => {
    resendState.value = { ...resendState.value, [userId]: 'sending' }
    try {
        await deploymentApi.resendAccess(deploymentId, teamId, userId)
        resendState.value = { ...resendState.value, [userId]: 'sent' }
        toastStore.addToast({
            type: 'success',
            message: t('DeploymentDetailView.resendAccessSuccess'),
        })
        window.setTimeout(() => {
            const next = { ...resendState.value }
            delete next[userId]
            resendState.value = next
        }, 2000)
    } catch (err: any) {
        resendState.value = { ...resendState.value, [userId]: 'error' }
        // Backend returns ``{detail: {reason: '...'}}``; surface the
        // reason verbatim — the UI doesn't need to localise every
        // possible code, the toast is for the operator.
        //
        // Two reasons get a dedicated toast string so the user
        // understands WHY mail didn't go out:
        //   * smtp_disabled (503): platform-wide kill-switch; needs
        //     an admin to flip ``SMTP_ENABLED`` in the backend env.
        //     A generic "Failed to send" toast would mislead them
        //     into thinking the SMTP server is down.
        //   * everything else: stays in the existing failure path
        //     so SMTP-rejected-the-recipient, transient errors, and
        //     unknown reasons all get the verbose toast.
        const reason = err?.response?.data?.detail?.reason || err?.message || 'unknown'
        const isSmtpDisabled = err?.response?.status === 503 && reason === 'smtp_disabled'
        const isDeploymentBusyErr = err?.response?.status === 409 && reason === 'deployment_busy'
        toastStore.addToast({
            type: (isSmtpDisabled || isDeploymentBusyErr) ? 'warning' : 'error',
            message: isSmtpDisabled
                ? t('DeploymentDetailView.resendAccessSmtpDisabled')
                : isDeploymentBusyErr
                    ? t('DeploymentDetailView.resendAccessDeploymentBusy')
                    : `${t('DeploymentDetailView.resendAccessError')}: ${reason}`,
        })
        window.setTimeout(() => {
            const next = { ...resendState.value }
            delete next[userId]
            resendState.value = next
        }, 3000)
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
        <div class="flex items-center justify-between">
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
                    :variant="pauseResumeAction === 'pause' ? 'yellow' : 'green'">
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
                    class="flex items-center gap-2 px-4 py-2" variant="yellow">
                    <StopCircle :size="18" />
                    <span class="font-medium">{{ $t('DeploymentDetailView.deploymentStop') }}</span>
                </BaseButton>

                <!-- Single Delete button. The backend decides whether this
                     triggers a destroy task or a straight soft-delete based on
                     status. Hidden entirely for members. -->
                <BaseButton v-if="isOwnerView" @click="canDelete && (showDeleteModal = true)" :disabled="!canDelete"
                    :title="deleteDisabledReason" class="flex items-center gap-2 px-4 py-2" variant="red">
                    <Trash2 :size="18" />
                    <span class="font-medium">{{ $t('DeploymentDetailView.deploymentDelete') }}</span>
                </BaseButton>
            </div>
        </div>

        <!-- Main info grid with 3 cards -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

            <!-- Deployment info card -->
            <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
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
                        <div class="text-sm">
                            <span
                                class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300">
                                <GitBranch :size="12" class="mr-1" />
                                {{ deployment.releaseTag }}
                            </span>
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
            <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
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
            <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
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
        <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm" v-if="groups.length > 0">
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
                    <div v-for="group in groups" :key="group.index" @click="selectGroup(group.index)"
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
        <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
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
                                <div v-if="team.vm?.url"
                                    class="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                    <span class="text-gray-400 font-sans text-[10px] uppercase tracking-wider flex-shrink-0">User:</span>
                                    <span>{{ member.account.data.username }}</span>
                                    <button
                                        @click="copyToClipboard(member.account.data.username, 'user-' + member.account.key)"
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

                                <div v-if="member.account.data.ip && member.account.data.port && member.account.data.type !== 'ssh_key' && member.account.data.authtype !== 'ssh' && member.account.data.authtype !== 'rdp' && member.account.data.port !== 22"
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

                            <div class="flex-shrink-0 flex lg:justify-end">
                                <button v-if="isOwnerView || String(member.userId) === String(authStore.userId)"
                                    @click="resendAccess(team.teamId, member.userId)"
                                    :disabled="resendState[member.userId] === 'sending' || isDeploymentBusy"
                                    :title="isDeploymentBusy
                                        ? $t('DeploymentDetailView.resendAccessBusyTooltip')
                                        : $t('DeploymentDetailView.resendAccessTooltip')"
                                    class="w-full lg:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors"
                                    :class="resendState[member.userId] === 'sent'
                                        ? 'bg-green-600 text-white border-green-600'
                                        : resendState[member.userId] === 'error'
                                            ? 'bg-red-50 text-red-700 border-red-300'
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 disabled:opacity-50'">
                                    <Loader2 v-if="resendState[member.userId] === 'sending'" :size="14"
                                        class="animate-spin" />
                                    <Check v-else-if="resendState[member.userId] === 'sent'" :size="14" />
                                    <AlertCircle v-else-if="resendState[member.userId] === 'error'" :size="14" />
                                    <Send v-else :size="14" />
                                    <span>
                                        {{ resendState[member.userId] === 'sending'
                                            ? $t('DeploymentDetailView.resendAccessSending')
                                            : resendState[member.userId] === 'sent'
                                                ? $t('DeploymentDetailView.resendAccessSent')
                                                : resendState[member.userId] === 'error'
                                                    ? $t('DeploymentDetailView.resendAccessRetry')
                                                    : $t('DeploymentDetailView.resendAccessButton') }}
                                    </span>
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Infrastructure section — per-VM cards + read-only listings.
             Owner-only (the backend gates it the same way); members
             skip the section entirely so they don't see an empty/
             permission-error panel. Visually mirrors the other
             page sections (Teams, Tasks, Outputs): same
             ``bg-white rounded-xl border ... p-6 shadow-sm`` shell,
             same icon-tile header, same sub-section spacing. -->
        <div v-if="isOwnerView"
             class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-8">
            <div class="flex items-center justify-between mb-5 gap-3 flex-wrap">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-gray-100 rounded-lg">
                        <Server :size="20" class="text-gray-600" />
                    </div>
                    <span class="text-lg font-semibold text-gray-900">Infrastruktur</span>
                </div>
                <button
                    @click="loadResources()"
                    :disabled="resourcesLoading"
                    class="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition-colors"
                    title="Live-Status neu abfragen"
                >
                    <RefreshCw :size="13" :class="resourcesLoading ? 'animate-spin' : ''" />
                    Aktualisieren
                </button>
            </div>

            <div
                v-if="resourcesError"
                class="text-sm p-3 rounded-lg border bg-red-50 text-red-800 border-red-200 mb-4 flex items-start gap-2"
            >
                <AlertCircle :size="16" class="mt-0.5 shrink-0" />
                <p>{{ resourcesError }}</p>
            </div>

            <!-- VMs — primary section, cards inherit their own visual
                 styling from ``InfrastructureVmCard``. -->
            <section class="mb-6">
                <div class="flex items-center gap-2 mb-3">
                    <Server :size="14" class="text-gray-400" />
                    <h3 class="text-sm font-bold uppercase tracking-wider text-gray-600">
                        Virtuelle Maschinen
                    </h3>
                    <span
                        v-if="vmResources.length > 0"
                        class="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded"
                    >
                        {{ vmResources.length }}
                    </span>
                </div>
                <div
                    v-if="resourcesLoading && vmResources.length === 0"
                    class="text-sm text-gray-500 italic px-4 py-6 bg-gray-50 rounded-lg border border-gray-100 text-center"
                >
                    Lade VMs…
                </div>
                <div
                    v-else-if="vmResources.length === 0"
                    class="text-sm text-gray-500 italic px-4 py-6 bg-gray-50 rounded-lg border border-gray-100 text-center"
                >
                    Keine VMs im aktuellen Terraform-State.
                </div>
                <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <InfrastructureVmCard
                        v-for="vm in vmResources"
                        :key="vm.address"
                        :resource="vm"
                        :redeploying="redeployInFlight.has(vm.address)"
                        :is-expanded="openDrawerAddress === vm.address"
                        @open-details="openVmDrawer"
                        @redeploy="redeployVm"
                    />
                </div>
            </section>

            <!-- Networks / Subnets / Floating IPs (read-only) -->
            <section v-if="networkResources.length > 0" class="mb-6">
                <div class="flex items-center gap-2 mb-3">
                    <Network :size="14" class="text-gray-400" />
                    <h3 class="text-sm font-bold uppercase tracking-wider text-gray-600">
                        Netzwerk
                    </h3>
                    <span class="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded">
                        {{ networkResources.length }}
                    </span>
                </div>
                <ul class="space-y-1.5 text-xs">
                    <li
                        v-for="res in networkResources"
                        :key="res.address"
                        class="px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between"
                    >
                        <div class="min-w-0">
                            <p class="font-semibold text-gray-900 truncate">
                                {{ res.display_name }}
                            </p>
                            <p class="text-gray-500 font-mono truncate" :title="res.address">
                                {{ res.address }}
                            </p>
                        </div>
                        <span class="text-[10px] uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-gray-300 text-gray-600 ml-2 shrink-0">
                            {{ res.category }}
                        </span>
                    </li>
                </ul>
            </section>

            <!-- Security Groups (read-only) -->
            <section v-if="securityResources.length > 0">
                <div class="flex items-center gap-2 mb-3">
                    <Shield :size="14" class="text-gray-400" />
                    <h3 class="text-sm font-bold uppercase tracking-wider text-gray-600">
                        Sicherheit
                    </h3>
                    <span class="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded">
                        {{ securityResources.length }}
                    </span>
                </div>
                <ul class="space-y-1.5 text-xs">
                    <li
                        v-for="res in securityResources"
                        :key="res.address"
                        class="px-3 py-2 bg-gray-50 rounded-lg border border-gray-100"
                    >
                        <p class="font-semibold text-gray-900">{{ res.display_name }}</p>
                        <p class="text-gray-500 font-mono">{{ res.address }}</p>
                    </li>
                </ul>
            </section>
        </div>

        <!-- Tasks / Logs Section — history of finished tasks. The active
             task (if any) is rendered above in its own card, so the
             list filters it out to avoid double-rendering.
             Only the deployment owner / staff sees the actual task
             contents — members get a placeholder card instead so the
             page layout stays consistent across roles. -->
        <div v-if="!isOwnerView" class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
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
        <div v-else class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
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
                    <div v-for="task in historyTasks" :key="task.taskId" @click="selectTask(task)"
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

                    <div v-if="activeDataTask?.tf_state" class="mb-4">
                        <div class="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">

                            <div
                                class="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between select-none">
                                <div class="flex items-center gap-2">
                                    <div class="p-1.5 bg-white rounded-md border border-blue-200">
                                        <Settings :size="16" class="text-blue-600" />
                                    </div>
                                    <div class="flex flex-col text-left">
                                        <span class="font-semibold text-gray-900">{{
                                            $t('DeploymentDetailView.terraformState')
                                            }}</span>
                                        <span class="text-xs text-gray-500">
                                            {{ tfResourcesCount > 0 ? `${tfResourcesCount} verwaltete Ressourcen` :
                                                'Erweiterte Details' }}
                                        </span>
                                    </div>
                                </div>

                                <button @click="copyToClipboard(prettyJson(activeDataTask?.tf_state), 'tf_state')"
                                    :title="copiedKey === 'tf_state' ? 'Kopiert!' : 'In die Zwischenablage kopieren'"
                                    class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors flex-shrink-0"
                                    :class="copiedKey === 'tf_state'
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'">
                                    <component :is="copiedKey === 'tf_state' ? Check : Copy" :size="13" />
                                    {{ copiedKey === 'tf_state' ? 'Copied' : 'Copy' }}
                                </button>
                            </div>

                            <div class="bg-white p-4 overflow-y-auto max-h-[500px]">
                                <div
                                    class="font-mono text-xs leading-relaxed text-left whitespace-pre-wrap select-text">
                                    <pre v-html="highlightJson(prettyJson(activeDataTask.tf_state))"></pre>
                                </div>
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
                <p class="text-gray-700" v-html="$t('DeploymentDetailView.confirmStopMessage', { name: deployment.name })"></p>
            </template>
            <template #footer>
                <div class="flex justify-end gap-3">
                    <BaseButton variant="ghost" @click="showCancelModal = false">
                        {{ $t('DeploymentDetailView.cancelButton') }}
                    </BaseButton>
                    <BaseButton variant="yellow" :disabled="cancelBusy" @click="confirmCancel">
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
                <p class="text-gray-700" v-html="$t('DeploymentDetailView.confirmDeleteMessage', { name: deployment.name })"></p>
            </template>
            <template #footer>
                <div class="flex justify-end gap-3">
                    <BaseButton variant="ghost" @click="showDeleteModal = false">
                        {{ $t('DeploymentDetailView.cancelButton') }}
                    </BaseButton>
                    <BaseButton variant="red" @click="confirmDelete">
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
                VM neu erstellen?
            </template>
            <template #body>
                <div class="space-y-3">
                    <p class="text-gray-700">
                        Diese VM wird zerstört und identisch neu erstellt.
                        Andere VMs in diesem Deployment bleiben unangetastet.
                    </p>
                    <p v-if="redeployTargetAddress" class="text-xs font-mono text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 break-all">
                        {{ redeployTargetAddress }}
                    </p>
                </div>
            </template>
            <template #footer>
                <div class="flex justify-end gap-3">
                    <BaseButton variant="ghost" @click="showRedeployModal = false">
                        {{ $t('DeploymentDetailView.cancelButton') }}
                    </BaseButton>
                    <BaseButton variant="red" @click="confirmRedeploy">
                        Redeploy
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
                <p class="text-gray-700" v-html="pauseResumeAction === 'pause'
                    ? $t('DeploymentDetailView.confirmPauseMessage', { name: deployment.name })
                    : $t('DeploymentDetailView.confirmResumeMessage', { name: deployment.name })"></p>
            </template>
            <template #footer>
                <div class="flex justify-end gap-3">
                    <BaseButton variant="ghost" @click="showPauseResumeModal = false">
                        {{ $t('DeploymentDetailView.cancelButton') }}
                    </BaseButton>
                    <BaseButton
                        :variant="pauseResumeAction === 'pause' ? 'yellow' : 'green'"
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