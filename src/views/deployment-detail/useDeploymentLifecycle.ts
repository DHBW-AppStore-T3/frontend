/**
 * Lifecycle actions of a deployment with their modals and busy flags: cancel,
 * delete, pause/resume (issue 146). A 202 reloads deployment and tasks and lets the
 * stream / active-task plumbing take over.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToastStore } from '@/stores/toast.store'
import { extractErrorMessage, localizedError } from '@/utils/http-error'
import { paths } from '@/router/paths'
import type { lifecycleGates } from './access'

export function useDeploymentLifecycle(
  deploymentId: string,
  gates: ReturnType<typeof lifecycleGates>,
  loadTasks: () => Promise<unknown>,
) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const te = (key: string) => i18n.exists(key)

  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPauseResumeModal, setShowPauseResumeModal] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [pauseResumeBusy, setPauseResumeBusy] = useState(false)

  // Cancel revokes the worker task and runs a destroy that also cleans up
  // everything the deployment created; the 202 response flows into the existing SSE plumbing.
  const confirmCancel = async () => {
    if (!deploymentId || cancelBusy) return
    const toasts = useToastStore.getState()
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
    const toasts = useToastStore.getState()
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

  // `pauseResumeBusy` debounces the call.
  const confirmPauseResume = async () => {
    if (!deploymentId || pauseResumeBusy) return
    const action = gates.pauseResumeAction
    if (!action) return
    const toasts = useToastStore.getState()
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

  return {
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
