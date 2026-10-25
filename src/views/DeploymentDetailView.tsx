import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  CircleArrowLeft,
  Loader2,
  Users,
  Settings,
  Trash2,
  GitBranch,
  User,
  Calendar,
  Package,
  StopCircle,
  PauseCircle,
  PlayCircle,
} from 'lucide-react'
import BaseButton from '@/components/ui/BaseButton'
import Modal from '@/components/ui/Modal'
import PodWorkloadsPanel from '@/components/PodWorkloadsPanel'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import { formatDateTime } from '@/utils/format'
import { safeHttpUrl } from '@/utils/safe-url'
import { paths } from '@/router/paths'
import BoldSlot from '@/i18n/BoldSlot'
import { useDeploymentDetail } from './deployment-detail/useDeploymentDetail'
import { useClipboard } from './deployment-detail/useClipboard'
import { cleanVariableValue, getStatusStyles } from './deployment-detail/helpers'
import ActiveTaskCard from './deployment-detail/ActiveTaskCard'
import TeamsCard from './deployment-detail/TeamsCard'
import TaskHistoryCard from './deployment-detail/TaskHistoryCard'

const HEADER_ICON_COLOR: Record<string, string> = {
  success: 'text-green-600',
  failed: 'text-red-600',
  running: 'text-blue-600',
}

const COMMIT_SHORT_LENGTH = 8

function pauseResumeMessageKey(action: 'pause' | 'resume' | null): string {
  const base = action === 'pause' ? 'confirmPauseMessagePods' : 'confirmResumeMessagePods'
  return `DeploymentDetailView.${base}`
}

export default function DeploymentDetailView() {
  const { id = '' } = useParams()
  const { t } = useTranslation()
  const d = useDeploymentDetail(id)
  const { copiedKey, copy } = useClipboard()
  const { deployment } = d

  // Loading state
  if (!deployment) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    )
  }

  const status = getStatusStyles(deployment.status)
  const StatusIcon = status.icon
  const PauseResumeIcon = d.pauseResumeAction === 'pause' ? PauseCircle : PlayCircle

  return (
    <div className="space-y-6">
      {/* Two-column layout: the content stays on the left, the VM-detail
          sidebar anchors as a sticky right column when a VM is selected. */}
      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0 space-y-6">
          {/* Header with back button and status badge */}
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to={paths.deployments}>
                <button
                  type="button"
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 transition"
                >
                  <CircleArrowLeft size={24} className="text-gray-700" />
                </button>
              </Link>

              <div>
                <h1 className="text-3xl font-bold text-gray-900">{deployment.name}</h1>
                <p className="text-sm text-gray-500 mt-1">Deployment Details</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <StatusIcon
                  size={20}
                  className={HEADER_ICON_COLOR[deployment.status ?? ''] ?? 'text-yellow-600'}
                />
                <span
                  className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold border capitalize ${status.badgeClass}`}
                >
                  {t(status.label)}
                </span>
              </div>

              {/* Pause / Resume: one slot, two states, visible only when the
                  lifecycle matrix permits the action right now. */}
              {d.canPauseOrResume ? (
                <BaseButton
                  onClick={() => !d.pauseResumeBusy && d.setShowPauseResumeModal(true)}
                  disabled={d.pauseResumeBusy}
                  title={
                    d.pauseResumeAction === 'pause'
                      ? t('DeploymentDetailView.pauseTooltip')
                      : t('DeploymentDetailView.resumeTooltip')
                  }
                  className="flex items-center gap-2 px-4 py-2"
                  variant={d.pauseResumeAction === 'pause' ? 'primary' : 'secondary'}
                >
                  <PauseResumeIcon size={18} />
                  <span className="font-medium">
                    {d.pauseResumeAction === 'pause'
                      ? t('DeploymentDetailView.deploymentPause')
                      : t('DeploymentDetailView.deploymentResume')}
                  </span>
                </BaseButton>
              ) : null}

              {/* Stop: only while a worker task is in flight. Revokes the task
                  and cleans up everything it created, including the Packer
                  build instance Terraform knows nothing about. */}
              {d.canCancel ? (
                <BaseButton
                  onClick={() => d.setShowCancelModal(true)}
                  disabled={d.cancelBusy}
                  className="flex items-center gap-2 px-4 py-2"
                  variant="primary"
                >
                  <StopCircle size={18} />
                  <span className="font-medium">{t('DeploymentDetailView.deploymentStop')}</span>
                </BaseButton>
              ) : null}

              {/* Single Delete button. The backend decides whether this
                  triggers a destroy task or a straight soft-delete based on
                  status. Hidden entirely for members. */}
              {d.isOwnerView ? (
                <BaseButton
                  data-testid="btn-delete-deployment"
                  onClick={() => d.canDelete && d.setShowDeleteModal(true)}
                  disabled={!d.canDelete}
                  title={d.deleteDisabledReason}
                  className="flex items-center gap-2 px-4 py-2"
                  variant="destructive"
                >
                  <Trash2 size={18} />
                  <span className="font-medium">{t('DeploymentDetailView.deploymentDelete')}</span>
                </BaseButton>
              ) : null}
            </div>
          </div>

          {/* Main info grid with 3 cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Deployment info card */}
            <div className="detail-surface">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package size={20} className="text-primary" />
                Deployment Info
              </h2>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                    {t('DeploymentsView.deploymentName')}
                  </div>
                  <div className="text-sm font-medium text-gray-900">{deployment.name}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Release Tag</div>
                  <div className="text-sm">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300">
                      <GitBranch size={12} className="mr-1" />
                      {deployment.releaseTag}
                    </span>
                    {deployment.commit_sha ? (
                      <span className="ml-2 font-mono text-xs text-gray-500" title={deployment.commit_sha}>
                        {deployment.commit_sha.slice(0, COMMIT_SHORT_LENGTH)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                    {t('DeploymentDetailView.runtime')}
                  </div>
                  <div className="text-sm font-medium text-gray-900" data-testid="deployment-runtime">
                    {t('runtime.kubernetes')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                    {t('DeploymentDetailView.deploymentCreated')}
                  </div>
                  <div className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <Calendar size={14} />
                    {deployment.created_at ? formatDateTime(deployment.created_at) : '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* App info card */}
            <div className="detail-surface">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package size={20} className="text-emerald-600" />
                {t('DeploymentsView.deploymentApp')}
              </h2>
              {deployment.app ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">App Name</div>
                    <div className="text-sm font-medium text-gray-900">{deployment.app.name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      {t('DeploymentDetailView.deploymentDescription')}
                    </div>
                    {deployment.app.description && deployment.app.description.trim() ? (
                      <div className="text-sm">
                        <MarkdownRenderer
                          source={deployment.app.description}
                          variant="compact"
                          clamp={3}
                          expandable
                        />
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 italic">No description</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Git Repository</div>
                    <a
                      href={safeHttpUrl(deployment.app.git_link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
                    >
                      {deployment.app.git_link}
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">No app information available</div>
              )}
            </div>

            {/* User info card */}
            <div className="detail-surface">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User size={20} className="text-blue-600" />
                {t('DeploymentDetailView.deploymentOwner')}
              </h2>
              {deployment.user ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      {t('DeploymentDetailView.deploymentUserName')}
                    </div>
                    <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary font-bold">
                        {deployment.user.username.substring(0, 2).toUpperCase()}
                      </div>
                      {deployment.user.username}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Email</div>
                    <div className="text-sm text-gray-700">{deployment.user.email}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      {t('DeploymentDetailView.deploymentUserRole')}
                    </div>
                    <div className="text-sm">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300 capitalize">
                        {deployment.user.role}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">No user information available</div>
              )}
            </div>
          </div>

          {/* Groups section */}
          {d.groups.length > 0 ? (
            <div className="detail-surface">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users size={20} className="text-primary" />
                {t('DeploymentDetailView.deploymentGroups')}
              </h2>

              {d.currentGroup ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <button
                    type="button"
                    onClick={d.deselectGroup}
                    className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors mb-3 group"
                  >
                    <CircleArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-medium">{t('DeploymentDetailView.deploymentGroupsBack')}</span>
                  </button>

                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-primary font-bold text-sm">{d.currentGroup.index + 1}</span>
                    </div>
                    <div className="font-semibold text-lg">{d.currentGroup.name}</div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                      {t('DeploymentDetailView.deploymentStudentCount', {
                        count: d.currentGroup.students.length,
                      })}
                    </div>
                    {d.currentGroup.students.map((student, idx) => (
                      <div
                        key={student}
                        className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-gray-200"
                      >
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary font-bold">
                          {idx + 1}
                        </div>
                        <span className="font-mono text-sm text-gray-700">{student}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {d.groups.map((group) => (
                    <div
                      key={group.index}
                      data-testid="group-card"
                      onClick={() => d.selectGroup(group.index)}
                      className="bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors border border-gray-200 hover:border-primary/30"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-primary font-bold text-sm">{group.index + 1}</span>
                        </div>
                        <div className="font-semibold">{group.name}</div>
                      </div>
                      <div className="text-sm text-gray-600 ml-11">
                        {t('DeploymentDetailView.deploymentStudentCount', { count: group.students.length })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* Deployment variables */}
          {Object.keys(d.deploymentVariables).length > 0 ? (
            <div className="detail-surface">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Settings size={20} className="text-orange-600" />
                {t('DeploymentDetailView.deploymentConfig')}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(d.deploymentVariables).map(([key, value]) => (
                  <div key={key} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-mono">{key}</div>
                    <div className="font-medium text-gray-800 break-all text-sm">{cleanVariableValue(value)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Active task — live progress + log tail for the running task. */}
          {d.isStreamRelevant && d.activeTask ? (
            <ActiveTaskCard
              task={d.activeTask}
              connectionState={d.streamConnectionState}
              progress={d.streamProgress}
              currentPhase={d.streamCurrentPhase}
              rawPhaseIndex={d.streamCurrentPhaseIndex}
              currentPhaseIndex={d.currentPhaseIndex}
              phaseStepCount={d.phaseStepCount}
              phaseLabel={d.phaseLabel}
              phaseStepLabel={d.phaseStepLabel}
              liveLogs={d.streamLiveLogs}
              totalLogCount={d.streamTotalLogCount}
            />
          ) : null}

          {/* Teams & Members — above the workloads so the human-readable view
              (who has access to what) precedes the technical listing. */}
          {deployment.teams && deployment.teams.length > 0 ? (
            <TeamsCard
              teamCount={deployment.teams.length}
              teams={d.enrichedTeams}
              copiedKey={copiedKey}
              onCopy={(text, key) => void copy(text, key)}
            />
          ) : null}

          {/* Pods: their workloads, live from the cluster. Owner view only; the
              backend gates the endpoint the same way. */}
          {d.isOwnerView && d.isPods ? (
            <PodWorkloadsPanel
              workloads={d.workloads}
              loading={d.resourcesLoading}
              error={d.resourcesError}
              live={d.workloadsLive}
              canAct={d.canRedeploy}
              busy={d.workloadBusy}
              onRefresh={() => void d.loadResources()}
              onRestart={d.restartWorkload}
              onReset={d.askResetWorkload}
            />
          ) : null}

          {/* Tasks / Logs — history of finished tasks. */}
          <TaskHistoryCard
            isOwnerView={d.isOwnerView}
            isStreamRelevant={d.isStreamRelevant}
            historyTasks={d.historyTasks}
            loadingTasks={d.loadingTasks}
            selectedTask={d.selectedTask}
            loadingTaskDetail={d.loadingTaskDetail}
            logCount={d.logCount}
            taskLogsSplit={d.taskLogsSplit}
            copiedKey={copiedKey}
            onCopy={(text, key) => void copy(text, key)}
            onSelectTask={(task) => void d.selectTask(task)}
            onDeselectTask={d.deselectTask}
          />
        </div>

      </div>

      {/* Stop confirmation. Worth a confirm: cancelling throws away an
          in-flight build that may be 20 minutes in. */}
      <Modal
        show={d.showCancelModal}
        onClose={() => d.setShowCancelModal(false)}
        title={t('DeploymentDetailView.confirmStopTitle')}
        body={
          <p className="text-gray-700">
            <BoldSlot
              i18nKey='DeploymentDetailView.confirmStopMessagePods'
              slot="name"
              value={deployment.name}
            />
          </p>
        }
        footer={
          <div className="flex justify-end gap-3">
            <BaseButton variant="text" onClick={() => d.setShowCancelModal(false)}>
              {t('DeploymentDetailView.cancelButton')}
            </BaseButton>
            <BaseButton variant="primary" disabled={d.cancelBusy} onClick={() => void d.confirmCancel()}>
              {t('DeploymentDetailView.confirmButton')}
            </BaseButton>
          </div>
        }
      />

      <Modal
        show={d.showDeleteModal}
        onClose={() => d.setShowDeleteModal(false)}
        title={t('DeploymentDetailView.confirmDeleteTitle')}
        body={
          <p className="text-gray-700">
            <BoldSlot
              i18nKey='DeploymentDetailView.confirmDeleteMessagePods'
              slot="name"
              value={deployment.name}
            />
          </p>
        }
        footer={
          <div className="flex justify-end gap-3">
            <BaseButton variant="text" onClick={() => d.setShowDeleteModal(false)}>
              {t('DeploymentDetailView.cancelButton')}
            </BaseButton>
            <BaseButton
              variant="destructive"
              data-testid="btn-confirm-delete"
              onClick={() => void d.confirmDelete()}
            >
              {t('DeploymentDetailView.confirmButton')}
            </BaseButton>
          </div>
        }
      />

      {/* Reset one pod workload: its volume (the data) is deleted. */}
      <Modal
        show={d.showResetModal}
        onClose={() => d.setShowResetModal(false)}
        title={t('pods.confirmResetTitle')}
        body={
          <p className="text-gray-700">
            <BoldSlot
              i18nKey="pods.confirmResetMessage"
              slot="workload"
              value={d.resetTargetWorkload ?? ''}
              mono
            />
          </p>
        }
        footer={
          <div className="flex justify-end gap-3">
            <BaseButton variant="text" onClick={() => d.setShowResetModal(false)}>
              {t('DeploymentDetailView.cancelButton')}
            </BaseButton>
            <BaseButton variant="destructive" data-testid="btn-confirm-reset" onClick={() => void d.confirmResetWorkload()}>
              {t('pods.reset')}
            </BaseButton>
          </div>
        }
      />

      {/* Pause / Resume confirmation; title/body switch on the action. */}
      <Modal
        show={d.showPauseResumeModal}
        onClose={() => d.setShowPauseResumeModal(false)}
        title={
          d.pauseResumeAction === 'pause'
            ? t('DeploymentDetailView.confirmPauseTitle')
            : t('DeploymentDetailView.confirmResumeTitle')
        }
        body={
          <p className="text-gray-700">
            <BoldSlot
              i18nKey={pauseResumeMessageKey(d.pauseResumeAction)}
              slot="name"
              value={deployment.name}
            />
          </p>
        }
        footer={
          <div className="flex justify-end gap-3">
            <BaseButton variant="text" onClick={() => d.setShowPauseResumeModal(false)}>
              {t('DeploymentDetailView.cancelButton')}
            </BaseButton>
            <BaseButton
              variant={d.pauseResumeAction === 'pause' ? 'primary' : 'secondary'}
              onClick={() => void d.confirmPauseResume()}
              disabled={d.pauseResumeBusy}
            >
              {d.pauseResumeAction === 'pause'
                ? t('DeploymentDetailView.deploymentPause')
                : t('DeploymentDetailView.deploymentResume')}
            </BaseButton>
          </div>
        }
      />
    </div>
  )
}
