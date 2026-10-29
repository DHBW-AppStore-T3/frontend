import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { appApi } from '@/api/app.api'
import { useToast } from '@/composables/useToast'
import { paths } from '@/router/paths'
import type { AppVersionApproval } from '@/types'
import type { AppDetail } from './versionInfo'
import { buildEditPayload, type EditFormValues, type EditImage } from './editPayload'

const HTTP_CONFLICT = 409
const HTTP_UNPROCESSABLE = 422

/** ``detail`` of a 422 about the appstore.yaml (the backend's ``reason`` / ``errors`` / ``message``). */
interface SpecErrorDetail {
  reason?: string
  message?: string
  errors?: { loc: string; msg: string }[]
}

/** The parts of a failed API call these handlers read; ``err`` itself is ``unknown``. */
interface ApiFailure {
  response?: { status?: number; data?: { detail?: SpecErrorDetail | string | null } }
}

/** The lines of a 422 about the appstore.yaml: one per field problem, or the reason itself. */
function specErrorLines(detail: SpecErrorDetail, t: (key: string) => string): string[] {
  if (detail.reason === 'appstore_yaml_missing') return [t('AppsDetailView.submitModal.yamlMissing')]
  if (Array.isArray(detail.errors) && detail.errors.length) {
    return detail.errors.map((e) => `${e.loc}: ${e.msg}`)
  }
  return [String(detail.message ?? detail.reason)]
}

/**
 * Data and mutations of the app detail page: the app, its version approvals
 * (only when ``loadsApprovals`` says the view needs them), and the owner actions (submit/withdraw versions, toggle
 * privacy, edit, delete). Toasts and navigation are handled here so the view
 * stays declarative.
 */
export function useAppDetail(appId: string, loadsApprovals: (app: AppDetail) => boolean) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()

  const [app, setApp] = useState<AppDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [approvals, setApprovals] = useState<AppVersionApproval[]>([])
  const [withdrawingVersion, setWithdrawingVersion] = useState<string | null>(null)
  const [isTogglingPrivacy, setIsTogglingPrivacy] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [specErrors, setSpecErrors] = useState<string[]>([])
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSettingDeployVersion, setIsSettingDeployVersion] = useState(false)

  const fetchApprovals = useCallback(async () => {
    try {
      const res = await appApi.listVersionApprovals(appId)
      setApprovals(res.data)
    } catch {
      setApprovals([])
    }
  }, [appId])

  // Reads the current toast, translation and router; the load below must not restart for them.
  const reportLoadError = useEffectEvent(() => {
    toast.error(t('AppsDetailView.toasts.loadError'))
    navigate(paths.apps)
  })

  // The caller passes a fresh function on every render; it is read when the app has arrived.
  const needsApprovals = useEffectEvent((loaded: AppDetail) => loadsApprovals(loaded))

  // Initial load: the app, then (for owners/admins) its approvals.
  useEffect(() => {
    if (!appId) return
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      try {
        const response = await appApi.getById(appId, false)
        if (cancelled) return
        const loaded = response.data as unknown as AppDetail
        setApp(loaded)
        if (needsApprovals(loaded)) await fetchApprovals()
      } catch {
        if (cancelled) return
        reportLoadError()
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // Reload only when the app changes (``fetchApprovals`` changes with ``appId`` only).
  }, [appId, fetchApprovals])

  const submitVersion = async (versionTag: string, notes: string): Promise<boolean> => {
    setIsSubmitting(true)
    setSpecErrors([])
    try {
      await appApi.submitVersion(appId, versionTag, undefined, notes.trim() || undefined)
      toast.success(t('AppsDetailView.toasts.submitSuccess'))
      await fetchApprovals()
      return true
    } catch (err) {
      const response = (err as ApiFailure | null | undefined)?.response
      const status = response?.status
      const detail = response?.data?.detail
      if (status === HTTP_CONFLICT) {
        toast.warning(t('AppsDetailView.toasts.submitDuplicate'))
      } else if (status === HTTP_UNPROCESSABLE && typeof detail === 'object' && detail?.reason) {
        setSpecErrors(specErrorLines(detail, t))
      } else {
        toast.error(t('AppsDetailView.toasts.submitError'))
      }
      return false
    } finally {
      setIsSubmitting(false)
    }
  }

  const withdrawVersion = async (versionTag: string) => {
    setWithdrawingVersion(versionTag)
    try {
      await appApi.withdrawVersion(appId, versionTag)
      toast.success(t('AppsDetailView.toasts.withdrawSuccess'))
      await fetchApprovals()
    } catch {
      toast.error(t('AppsDetailView.toasts.withdrawError'))
    } finally {
      setWithdrawingVersion(null)
    }
  }

  const togglePrivacy = async () => {
    if (!app) return
    const next = !app.is_private
    setIsTogglingPrivacy(true)
    try {
      const { data } = await appApi.update(app.appId, { is_private: next })
      // The server's view: an admin making the app public also lifts hidden_by_admin.
      const updated = { ...app, is_private: data.is_private, hidden_by_admin: data.hidden_by_admin }
      setApp(updated)
      toast.success(updated.is_private ? t('AppsDetailView.toasts.setPrivate') : t('AppsDetailView.toasts.setPublic'))
    } catch {
      toast.error(t('AppsDetailView.toasts.updateError'))
    } finally {
      setIsTogglingPrivacy(false)
    }
  }

  /** Admin only: fix the version teachers deploy. Resolves ``true`` when it was saved. */
  const setDeployVersion = async (versionTag: string): Promise<boolean> => {
    setIsSettingDeployVersion(true)
    try {
      const res = await appApi.admin.setDeployVersion(appId, versionTag)
      setApp((prev) => (prev ? { ...prev, deploy_version: res.data.deploy_version } : prev))
      toast.success(t('AppsDetailView.toasts.deployVersionSet', { version: versionTag }))
      return true
    } catch {
      toast.error(t('AppsDetailView.toasts.deployVersionError'))
      return false
    } finally {
      setIsSettingDeployVersion(false)
    }
  }

  /** Resolves ``true`` when the edit dialog may close (saved or nothing to save). */
  const saveEdit = async (form: EditFormValues, image: EditImage): Promise<boolean> => {
    if (!app) return false
    const name = form.name.trim()
    if (!name) {
      toast.error(t('AppsDetailView.toasts.nameRequired'))
      return false
    }
    const payload = await buildEditPayload(app, { ...form, name }, image)
    if (Object.keys(payload).length === 0) return true

    setIsSavingEdit(true)
    try {
      const { data } = await appApi.update(app.appId, payload)
      // Take what the backend actually stored (image/description/name).
      setApp({ ...app, ...data } as AppDetail)
      toast.success(t('AppsDetailView.toasts.editSuccess'))
      return true
    } catch {
      toast.error(t('AppsDetailView.toasts.editError'))
      return false
    } finally {
      setIsSavingEdit(false)
    }
  }

  const deleteApp = async (): Promise<boolean> => {
    if (!app) return false
    const id = app.appId || app.id || app._id
    if (!id) {
      toast.error(t('AppsDetailView.deleteErrorToast'))
      return false
    }
    setIsDeleting(true)
    try {
      await appApi.delete(id)
      toast.success(t('AppsDetailView.deleteSuccessToast'))
      navigate(paths.apps)
      return true
    } catch (error) {
      const detail = (error as ApiFailure | null | undefined)?.response?.data?.detail
      const reason = typeof detail === 'object' ? detail?.message || detail?.reason : detail
      toast.error(`${t('AppsDetailView.deleteErrorToast')}${reason ? ': ' + reason : ''}`)
      return false
    } finally {
      setIsDeleting(false)
    }
  }

  return {
    app,
    isLoading,
    approvals,
    withdrawingVersion,
    isTogglingPrivacy,
    isSubmitting,
    specErrors,
    clearSpecErrors: () => setSpecErrors([]),
    isSavingEdit,
    isDeleting,
    isSettingDeployVersion,
    setDeployVersion,
    submitVersion,
    withdrawVersion,
    togglePrivacy,
    saveEdit,
    deleteApp,
  }
}
