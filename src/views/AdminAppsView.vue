<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ChevronDown, ChevronRight,
  Check, X, RotateCcw, Inbox, ExternalLink,
} from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import Modal from '@/components/ui/Modal.vue'
import AppVersionStatusBadge from '@/components/ui/AppVersionStatusBadge.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EntityListState from '@/components/ui/EntityListState.vue'
import { appApi } from '@/api/app.api'
import { useToast } from '@/composables/useToast'
import { formatDate } from '@/utils/format'
import type { App, AppVersionApproval } from '@/types'

const { t } = useI18n()
const toast = useToast()

// ----------------------------------------------------------------
// State
// ----------------------------------------------------------------
const isLoading = ref(true)
const apps = ref<App[]>([])
// appId → pending count (from initial pending queue load)
const pendingCountMap = ref<Record<string, number>>({})
// appId → total submission count (any status)
const submissionCountMap = ref<Record<string, number>>({})
// appId → loaded approvals (lazy)
const approvalsMap = ref<Record<string, AppVersionApproval[]>>({})
// appId → currently loading
const loadingMap = ref<Record<string, boolean>>({})
// which app is expanded
const expandedAppId = ref<string | null>(null)
// filter: true = only apps with submissions
const onlyWithSubmissions = ref(true)

// Reject modal (single version only)
const showRejectModal = ref(false)
const rejectTarget = ref<{ appId: string; appName: string; versionTag: string } | null>(null)
const rejectionReason = ref('')
const isRejecting = ref(false)

// Revoke modal
const showRevokeModal = ref(false)
const revokeTarget = ref<{ appId: string; versionTag: string } | null>(null)
const revokeReason = ref('')
const isRevoking = ref(false)

// Per-version action loading
const actingOn = ref<string | null>(null) // `${appId}:${versionTag}`

// ----------------------------------------------------------------
// Computed
// ----------------------------------------------------------------
const sortedApps = computed(() => {
  const filtered = onlyWithSubmissions.value
    ? apps.value.filter(a => (submissionCountMap.value[a.appId] ?? 0) > 0)
    : apps.value
  return [...filtered].sort((a, b) => {
    const pa = pendingCountMap.value[a.appId] ?? 0
    const pb = pendingCountMap.value[b.appId] ?? 0
    return pb - pa
  })
})

// ----------------------------------------------------------------
// Load
// ----------------------------------------------------------------
const loadAll = async () => {
  isLoading.value = true
  try {
    const [appsRes, pendingRes] = await Promise.all([
      appApi.list(),
      appApi.admin.listPendingApprovals(),
    ])
    apps.value = appsRes.data

    // Build pending + submission count maps from the pending queue
    const pending: Record<string, number> = {}
    const submissions: Record<string, number> = {}
    for (const item of pendingRes.data) {
      pending[item.appId] = (pending[item.appId] ?? 0) + 1
      submissions[item.appId] = (submissions[item.appId] ?? 0) + 1
    }
    pendingCountMap.value = pending
    submissionCountMap.value = submissions
  } catch {
    toast.error(t('AdminAppsView.loadError'))
  } finally {
    isLoading.value = false
  }
}

const loadApprovals = async (appId: string) => {
  if (approvalsMap.value[appId] !== undefined) return
  loadingMap.value[appId] = true
  try {
    const res = await appApi.listVersionApprovals(appId)
    approvalsMap.value[appId] = res.data
    // Update submission count now that we have the full picture
    submissionCountMap.value[appId] = res.data.length
    pendingCountMap.value[appId] = res.data.filter(a => a.status === 'pending').length
  } catch {
    approvalsMap.value[appId] = []
  } finally {
    loadingMap.value[appId] = false
  }
}

const toggleApp = async (appId: string) => {
  if (expandedAppId.value === appId) {
    expandedAppId.value = null
    return
  }
  expandedAppId.value = appId
  await loadApprovals(appId)
}

// ----------------------------------------------------------------
// Actions
// ----------------------------------------------------------------
const handleApprove = async (appId: string, _appName: string, versionTag: string) => {
  actingOn.value = `${appId}:${versionTag}`
  try {
    await appApi.admin.approveVersion(appId, versionTag)
    toast.success(t('AdminAppsView.approveSuccess'))
    // Update local state
    const list = approvalsMap.value[appId]
    if (list) {
      const entry = list.find(a => a.version_tag === versionTag)
      if (entry) entry.status = 'approved'
    }
    if (pendingCountMap.value[appId]) {
      pendingCountMap.value[appId] = Math.max(0, pendingCountMap.value[appId] - 1)
    }
  } catch {
    toast.error(t('AdminAppsView.approveError'))
  } finally {
    actingOn.value = null
  }
}

const openRejectModal = (appId: string, versionTag: string) => {
  rejectTarget.value = { appId, appName: '', versionTag }
  rejectionReason.value = ''
  showRejectModal.value = true
}

// Shared logic behind reject and revoke: both validate a target + reason,
// flip a loading flag, call an admin API method, mark the matching version
// entry as rejected with the given reason, close the modal, and clear the
// loading flag. Only the API method, the target, the i18n keys, the loading
// flag, the modal, and the optional pending-count decrement differ.
const submitRejection = async (params: {
  target: { appId: string; versionTag: string } | null
  reason: string
  apiCall: (appId: string, versionTag: string, reason: string) => Promise<unknown>
  setLoading: (value: boolean) => void
  closeModal: () => void
  successKey: string
  errorKey: string
  decrementPending: boolean
}) => {
  if (!params.target || !params.reason.trim()) return
  const { appId, versionTag } = params.target
  const reason = params.reason.trim()
  params.setLoading(true)
  try {
    await params.apiCall(appId, versionTag, reason)
    toast.success(t(params.successKey))
    const list = approvalsMap.value[appId]
    if (list) {
      const entry = list.find(a => a.version_tag === versionTag)
      if (entry) {
        entry.status = 'rejected'
        entry.rejection_reason = reason
      }
    }
    if (params.decrementPending && pendingCountMap.value[appId]) {
      pendingCountMap.value[appId] = Math.max(0, pendingCountMap.value[appId] - 1)
    }
    params.closeModal()
  } catch {
    toast.error(t(params.errorKey))
  } finally {
    params.setLoading(false)
  }
}

const handleReject = async () => {
  await submitRejection({
    target: rejectTarget.value,
    reason: rejectionReason.value,
    apiCall: appApi.admin.rejectVersion,
    setLoading: value => { isRejecting.value = value },
    closeModal: () => { showRejectModal.value = false },
    successKey: 'AdminAppsView.rejectSuccess',
    errorKey: 'AdminAppsView.rejectError',
    decrementPending: true,
  })
}

const openRevokeModal = (appId: string, versionTag: string) => {
  revokeTarget.value = { appId, versionTag }
  revokeReason.value = ''
  showRevokeModal.value = true
}

const handleRevoke = async () => {
  await submitRejection({
    target: revokeTarget.value,
    reason: revokeReason.value,
    apiCall: appApi.admin.revokeVersion,
    setLoading: value => { isRevoking.value = value },
    closeModal: () => { showRevokeModal.value = false },
    successKey: 'AdminAppsView.revokeSuccess',
    errorKey: 'AdminAppsView.revokeError',
    decrementPending: false,
  })
}

onMounted(loadAll)
</script>

<template>
  <div class="p-6">

    <PageHeader :title="$t('AdminAppsView.title')" :subtitle="$t('AdminAppsView.subtitle')">
      <template #actions>
        <!-- Filter toggle as the page action (page-specific, so it's a slot
             rather than hard-wired). -->
        <div class="flex items-center gap-2 text-sm">
          <span class="text-textMuted">{{ $t('AdminAppsView.filterLabel') }}</span>
          <button
            @click="onlyWithSubmissions = !onlyWithSubmissions"
            class="relative inline-flex h-5 w-10 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
            :class="onlyWithSubmissions ? 'bg-green-600' : 'bg-gray-300'"
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200"
              :class="onlyWithSubmissions ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
          <span class="text-textMuted font-medium">{{ $t('AdminAppsView.filterOnlySubmissions') }}</span>
        </div>
      </template>
    </PageHeader>

    <EntityListState
      :is-loading="isLoading && apps.length === 0"
      :is-empty="!isLoading && apps.length === 0"
      :icon="Inbox"
      :empty-message="$t('AdminAppsView.emptyAppsTitle')"
    >
      <!-- Accordion list. Apps with pending submissions come first (see
           ``sortedApps``). This is a list, not a grid, because the approval
           workflow needs expandable rows. -->

      <!-- Filter active but no open submissions → dedicated empty state
           (apps.length > 0 but sortedApps.length === 0). -->
      <div
        v-if="sortedApps.length === 0"
        class="flex flex-col items-center justify-center py-16 px-6 text-center bg-surfaceMuted border border-dashed border-borderSubtle rounded-xl"
      >
        <div class="w-14 h-14 rounded-full bg-white border border-borderSubtle flex items-center justify-center mb-4">
          <Inbox :size="28" class="text-textFaint" />
        </div>
        <h3 class="text-base font-semibold text-textHeading mb-1">
          {{ $t('AdminAppsView.emptyNoSubmissionsTitle') }}
        </h3>
        <p class="text-sm text-textMuted max-w-sm">
          {{ $t('AdminAppsView.emptyNoSubmissionsDesc') }}
        </p>
        <button
          @click="onlyWithSubmissions = false"
          class="mt-5 text-sm font-medium text-primary hover:text-primaryDark underline-offset-2 hover:underline"
        >
          {{ $t('AdminAppsView.emptyShowAll') }}
        </button>
      </div>

      <div v-else class="space-y-2">
      <div
        v-for="app in sortedApps"
        :key="app.appId"
        class="border border-borderSubtle rounded-xl overflow-hidden"
      >
        <!-- App row (header) -->
        <button
          class="w-full flex items-center gap-4 px-5 py-4 bg-white hover:bg-surfaceMuted transition-colors text-left"
          @click="toggleApp(app.appId)"
        >
          <component
            :is="expandedAppId === app.appId ? ChevronDown : ChevronRight"
            :size="18"
            class="text-textFaint flex-shrink-0"
          />

          <!-- App name -->
          <span class="font-semibold text-textHeading flex-grow">{{ app.name }}</span>

          <!-- Link to app detail -->
          <RouterLink
            :to="{ name: 'apps.detail', params: { id: app.appId } }"
            class="text-textFaint hover:text-primary transition-colors p-1 rounded"
            :title="$t('AdminAppsView.goToApp')"
            @click.stop
          >
            <ExternalLink :size="15" />
          </RouterLink>

          <!-- Pending badge -->
          <span
            v-if="pendingCountMap[app.appId] && !app.is_private"
            class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700"
          >
            {{ pendingCountMap[app.appId] }} {{ $t('AdminAppsView.pendingLabel') }}
          </span>
          <span
            v-else-if="app.is_private"
            class="text-xs text-purple-400"
          >
            {{ $t('AdminAppsView.privateLabel') }}
          </span>
          <span
            v-else
            class="text-xs text-textFaint"
          >
            {{ $t('AdminAppsView.noPendingLabel') }}
          </span>
        </button>

        <!-- Expanded: versions -->
        <div v-if="expandedAppId === app.appId" class="border-t border-borderSubtle bg-surfaceMuted">

          <!-- Private app: no pending submissions shown -->
          <div
            v-if="app.is_private"
            class="px-6 py-4 text-sm text-textFaint italic"
          >
            {{ $t('AdminAppsView.privateAppNote') }}
          </div>

          <!-- Loading approvals -->
          <div v-else-if="loadingMap[app.appId]" class="flex justify-center py-6">
            <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          </div>

          <!-- No entries -->
          <div
            v-else-if="!(approvalsMap[app.appId] ?? []).length"
            class="px-6 py-4 text-sm text-textFaint italic"
          >
            {{ $t('AdminAppsView.noVersionsSubmitted') }}
          </div>

          <!-- Version table -->
          <div v-else class="px-4 pb-3">
          <table class="w-full text-sm">
            <thead class="border-b border-borderSubtle">
              <tr>
                <th class="text-left py-2 px-2 text-xs font-semibold text-textMuted uppercase tracking-wide">{{ $t('AdminAppsView.colVersion') }}</th>
                <th class="text-left py-2 px-4 text-xs font-semibold text-textMuted uppercase tracking-wide">{{ $t('AdminAppsView.colStatus') }}</th>
                <th class="text-left py-2 px-4 text-xs font-semibold text-textMuted uppercase tracking-wide">{{ $t('AdminAppsView.colDate') }}</th>
                <th class="text-right py-2 px-2 text-xs font-semibold text-textMuted uppercase tracking-wide">{{ $t('AdminAppsView.colActions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="approval in (approvalsMap[app.appId] ?? [])"
                :key="approval.approvalId"
                class="bg-white hover:bg-surfaceMuted transition-colors"
              >
                <td class="py-3 px-2">
                  <span class="font-mono text-textHeading bg-surfaceMuted px-2 py-0.5 rounded text-xs">
                    {{ approval.version_tag }}
                  </span>
                </td>
                <td class="py-3 px-4">
                  <div class="space-y-1.5">
                    <AppVersionStatusBadge :status="approval.status" />
                    <div v-if="approval.notes" class="flex items-start gap-1.5 max-w-xs">
                      <span class="text-xs font-medium text-textFaint shrink-0 mt-px">{{ $t('AdminAppsView.notesLabel') }}</span>
                      <span class="text-xs text-textMuted italic truncate" :title="approval.notes">{{ approval.notes }}</span>
                    </div>
                    <div v-if="approval.rejection_reason" class="flex items-start gap-1.5 max-w-xs">
                      <span class="text-xs font-medium text-danger shrink-0 mt-px">{{ $t('AdminAppsView.rejectionLabel') }}</span>
                      <span class="text-xs text-danger italic truncate" :title="approval.rejection_reason">{{ approval.rejection_reason }}</span>
                    </div>
                  </div>
                </td>
                <td class="py-3 px-4 text-textMuted text-xs">
                  {{ formatDate(approval.created_at) }}
                </td>
                <td class="py-3 px-2">
                  <div class="flex justify-end gap-2">

                    <!-- Pending: Approve + Reject -->
                    <template v-if="approval.status === 'pending'">
                      <button
                        @click="handleApprove(app.appId, app.name, approval.version_tag)"
                        :disabled="actingOn === `${app.appId}:${approval.version_tag}`"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-successTint text-success border border-success/30 text-xs font-medium hover:bg-successTint transition-colors disabled:opacity-50"
                      >
                        <Check :size="13" />
                        {{ $t('AdminAppsView.approveBtn') }}
                      </button>
                      <button
                        @click="openRejectModal(app.appId, approval.version_tag)"
                        :disabled="actingOn === `${app.appId}:${approval.version_tag}`"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dangerTint text-red-700 border border-danger/30 text-xs font-medium hover:bg-dangerTint transition-colors disabled:opacity-50"
                      >
                        <X :size="13" />
                        {{ $t('AdminAppsView.rejectBtn') }}
                      </button>
                    </template>

                    <!-- Approved: Revoke -->
                    <template v-else-if="approval.status === 'approved'">
                      <button
                        @click="openRevokeModal(app.appId, approval.version_tag)"
                        :disabled="actingOn === `${app.appId}:${approval.version_tag}`"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surfaceMuted text-textMuted border border-borderSubtle text-xs font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                      >
                        <RotateCcw :size="13" />
                        {{ $t('AdminAppsView.revokeBtn') }}
                      </button>
                    </template>

                    <!-- Rejected: Approve again -->
                    <template v-else-if="approval.status === 'rejected'">
                      <button
                        @click="handleApprove(app.appId, app.name, approval.version_tag)"
                        :disabled="actingOn === `${app.appId}:${approval.version_tag}`"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-successTint text-success border border-success/30 text-xs font-medium hover:bg-successTint transition-colors disabled:opacity-50"
                      >
                        <Check :size="13" />
                        {{ $t('AdminAppsView.approveBtn') }}
                      </button>
                    </template>

                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          </div>

        </div>
      </div>
      </div>
    </EntityListState>

    <!-- Reject Modal -->
    <Modal :show="showRejectModal" @close="showRejectModal = false">
      <template #title>
        <span class="text-red-700">{{ $t('AdminAppsView.rejectModal.title') }}</span>
      </template>
      <template #body>
        <div class="space-y-5">
          <p class="text-sm text-textMuted">
            <span class="font-mono bg-surfaceMuted px-1.5 py-0.5 rounded text-xs">{{ rejectTarget?.versionTag }}</span>
            &nbsp;—&nbsp;{{ rejectTarget?.appName }}
          </p>
          <div>
            <label class="block text-sm font-medium text-textMuted mb-1.5">
              {{ $t('AdminAppsView.rejectModal.reasonLabel') }}
            </label>
            <textarea
              v-model="rejectionReason"
              :placeholder="$t('AdminAppsView.rejectModal.reasonPlaceholder')"
              rows="4"
              class="w-full rounded-lg border border-borderSubtle px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none resize-none"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <BaseButton variant="text" @click="showRejectModal = false" :disabled="isRejecting">
            {{ $t('AdminAppsView.rejectModal.cancel') }}
          </BaseButton>
          <BaseButton
            variant="destructive"
            @click="handleReject"
            :disabled="!rejectionReason.trim() || isRejecting"
          >
            {{ isRejecting ? '...' : $t('AdminAppsView.rejectModal.submit') }}
          </BaseButton>
        </div>
      </template>
    </Modal>

    <!-- Revoke Modal -->
    <Modal :show="showRevokeModal" @close="showRevokeModal = false">
      <template #title>
        <span class="text-textHeading">{{ $t('AdminAppsView.revokeModal.title') }}</span>
      </template>
      <template #body>
        <div class="space-y-5">
          <p class="text-sm text-textMuted">
            <span class="font-mono bg-surfaceMuted px-1.5 py-0.5 rounded text-xs">{{ revokeTarget?.versionTag }}</span>
          </p>
          <div>
            <label class="block text-sm font-medium text-textMuted mb-1.5">
              {{ $t('AdminAppsView.revokeModal.reasonLabel') }}
            </label>
            <textarea
              v-model="revokeReason"
              :placeholder="$t('AdminAppsView.revokeModal.reasonPlaceholder')"
              rows="4"
              class="w-full rounded-lg border border-borderSubtle px-3 py-2 text-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none resize-none"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <BaseButton variant="text" @click="showRevokeModal = false" :disabled="isRevoking">
            {{ $t('AdminAppsView.revokeModal.cancel') }}
          </BaseButton>
          <BaseButton
            variant="primary"
            @click="handleRevoke"
            :disabled="!revokeReason.trim() || isRevoking"
          >
            {{ isRevoking ? '...' : $t('AdminAppsView.revokeModal.submit') }}
          </BaseButton>
        </div>
      </template>
    </Modal>

  </div>
</template>
