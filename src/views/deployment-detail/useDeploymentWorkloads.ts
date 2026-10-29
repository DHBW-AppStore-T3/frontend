/**
 * Pod workloads of a deployment, read live from the cluster, and their actions
 * (restart; reset, which deletes the volume and therefore asks first) (issue 146).
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToastStore } from '@/stores/toast.store'
import { deploymentApi } from '@/api/deployment.api'
import { errorReason, localizedError } from '@/utils/http-error'
import type { PodWorkload } from '@/types'
import { permissionsOf } from './access'

/** How often the cluster is asked again while a workload is still starting. */
const WORKLOAD_POLL_MS = 10_000

export function useDeploymentWorkloads(deploymentId: string, loadTasks: () => Promise<unknown>) {
  const { t, i18n } = useTranslation()

  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [resourcesError, setResourcesError] = useState<string | null>(null)
  const [workloads, setWorkloads] = useState<PodWorkload[]>([])
  const [workloadsLive, setWorkloadsLive] = useState(true)
  const [workloadBusy, setWorkloadBusy] = useState<Set<string>>(new Set())
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetTargetWorkload, setResetTargetWorkload] = useState<string | null>(null)

  const te = useCallback((key: string) => i18n.exists(key), [i18n])

  const loadResources = useCallback(async () => {
    if (!permissionsOf(useDeploymentStore.getState().currentDeployment).owner_view) return
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
        // are gone; the stream watcher handles the `gone` path.
        setWorkloads([])
      } else setResourcesError(e?.message || t('pods.loadFailed'))
    } finally {
      setResourcesLoading(false)
    }
  }, [deploymentId, t, te])

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
    }, WORKLOAD_POLL_MS)
    return () => clearInterval(id)
  }, [workloadsChanging, deploymentId])

  const workloadAction = async (workload: string, reset: boolean) => {
    if (workloadBusy.has(workload)) return
    const toasts = useToastStore.getState()
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

  return {
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
  }
}
