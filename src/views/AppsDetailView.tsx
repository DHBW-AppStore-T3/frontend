import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, GitBranch, Layers, Pencil, ShoppingBag, Trash2 } from 'lucide-react'
import AppLogo from '@/components/ui/AppLogo'
import BaseButton from '@/components/ui/BaseButton'
import Modal from '@/components/ui/Modal'
import { useDeploymentStore } from '@/stores/deployment.store'
import {
  useOpenStackCredentialsStore,
  selectIsResolved,
  selectHasUsableCredential,
} from '@/stores/openstack-credentials.store'
import { useAuthStore, selectUserId } from '@/stores/auth.store'
import { useRole } from '@/composables/useRole'
import { useToast } from '@/composables/useToast'
import { paths } from '@/router/paths'
import { safeHttpUrl } from '@/utils/safe-url'
import BoldSlot from '@/i18n/BoldSlot'
import { useAppDetail } from './app-detail/useAppDetail'
import { useVersionRuntime } from './app-detail/useVersionRuntime'
import { canStartDeployment, needsCredential } from './app-detail/runtime'
import {
  bannerStatusOf,
  hasVersionInfo as hasInfo,
  indexApprovalsByVersion,
  toVersionInfo,
  versionDetailsOf,
  versionOptionsOf,
  type AppDetail,
} from './app-detail/versionInfo'
import OverviewTab from './app-detail/OverviewTab'
import StoreTab from './app-detail/StoreTab'
import EditAppModal from './app-detail/EditAppModal'
import SubmitVersionModal from './app-detail/SubmitVersionModal'
import './AppsDetailView.css'

type Tab = 'overview' | 'store'
const DEPLOYMENT_OPTIONS_HASH = '#deployment-options'

interface TabButtonProps {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
  badge?: ReactNode
}

function TabButton({ active, onClick, icon, label, badge }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-textMuted hover:text-textHeading hover:border-borderSubtle'
      }`}
    >
      {icon}
      {label}
      {badge}
    </button>
  )
}

export default function AppsDetailView() {
  const { id = '' } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { hash } = useLocation()
  const toast = useToast()
  const { isAdmin, isStaff } = useRole()
  const userId = useAuthStore(selectUserId)
  const credentialsResolved = useOpenStackCredentialsStore(selectIsResolved)
  const hasUsableCredential = useOpenStackCredentialsStore(selectHasUsableCredential)

  // Owner or admin may edit, delete and manage versions; mirrors the backend's
  // ``can_edit_app`` so the UI never offers actions that would 403.
  const isOwnerOf = (app: AppDetail) => String(app.userId) === String(userId)
  const canManage = (app: AppDetail) => isAdmin || isOwnerOf(app)

  const detail = useAppDetail(id, canManage)
  const { app } = detail

  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [selectedVersion, setSelectedVersion] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [submitTarget, setSubmitTarget] = useState<string | null>(null)

  const versionOptions = useMemo(() => versionOptionsOf(app), [app])
  // Default to the first version once the list is known.
  const effectiveVersion = selectedVersion || versionOptions[0] || ''
  const versionDetails = versionDetailsOf(app, effectiveVersion)
  const approvalByVersion = useMemo(() => indexApprovalsByVersion(detail.approvals), [detail.approvals])

  const versionRuntime = useVersionRuntime(app?.appId, effectiveVersion)
  const gate = {
    isStaff,
    version: effectiveVersion,
    runtime: versionRuntime.runtime,
    credentialsResolved,
    hasUsableCredential,
  }

  // Only VM apps need an OpenStack credential: read them for staff once.
  useEffect(() => {
    if (isStaff && !useOpenStackCredentialsStore.getState().credentials) {
      void useOpenStackCredentialsStore.getState().fetch()
    }
  }, [isStaff])

  const isOwner = !!app && isOwnerOf(app)
  const canManageVersions = !!app && canManage(app)
  const banner = bannerStatusOf(app, detail.approvals)

  const startDeployment = () => {
    if (!app || !effectiveVersion) {
      toast.warning(t('AppsDetailView.toasts.selectVersionFirst'))
      return
    }
    if (!canStartDeployment(gate)) return
    const drafts = useDeploymentStore.getState()
    drafts.resetDraft()
    // How the version runs travels with the draft (credential and group step).
    drafts.updateDraft({
      appId: app.appId || app.id || null,
      releaseTag: effectiveVersion,
      runtime: versionRuntime.runtime?.runtime ?? null,
      scope: versionRuntime.runtime?.scope ?? null,
    })
    toast.success(t('AppsDetailView.toasts.preparingConfig', { name: app.name }))
    navigate(paths.deploymentConfig)
  }

  const openSubmitModal = (version: string) => {
    detail.clearMarkerErrors()
    setSubmitTarget(version)
  }

  const submitVersion = async (notes: string) => {
    if (submitTarget && (await detail.submitVersion(submitTarget, notes))) setSubmitTarget(null)
  }

  const showStore = activeTab === 'store' && canManageVersions

  return (
    <div className="app-page app-detail-page">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center text-textMuted hover:text-textHeading transition-colors"
        >
          <ArrowLeft size={20} className="mr-2" /> {t('AppsDetailView.backToOverview')}
        </button>
      </div>

      {detail.isLoading ? (
        <div className="flex justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <div className="text-textFaint">{t('AppsDetailView.loading')}</div>
          </div>
        </div>
      ) : app ? (
        <div className="app-detail-content">
          {/* App header */}
          <div className="app-detail-heading">
            <span className="detail-app-logo">
              <AppLogo name={app.name} image={app.image} />
            </span>
            <div className="flex-grow">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-bold text-textHeading mb-2">{app.name}</h1>
                  <div className="flex items-center gap-3 text-sm text-textMuted">
                    <span className="flex items-center gap-1 bg-surfaceMuted px-2 py-1 rounded">
                      <GitBranch size={14} /> {app.versions?.length || 0} {t('AppsDetailView.versionsAvailable')}
                    </span>
                    {app.git_link ? (
                      <a
                        href={safeHttpUrl(app.git_link)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-info hover:underline cursor-pointer truncate max-w-xs block"
                      >
                        {app.git_link}
                      </a>
                    ) : null}
                  </div>
                </div>
                {canManageVersions ? (
                  <div className="flex items-center gap-2">
                    <BaseButton
                      onClick={() => setShowEditModal(true)}
                      className="flex items-center gap-2 px-4 py-2"
                      variant="text"
                    >
                      <Pencil size={18} />
                      <span className="font-medium">{t('AppsDetailView.editApp')}</span>
                    </BaseButton>
                    <BaseButton
                      onClick={() => setShowDeleteModal(true)}
                      className="flex items-center gap-2 px-4 py-2"
                      variant="destructive"
                    >
                      <Trash2 size={18} />
                      <span className="font-medium">{t('AppsDetailView.deleteApp')}</span>
                    </BaseButton>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 mb-8 border-b border-borderSubtle">
            <TabButton
              active={!showStore}
              onClick={() => setActiveTab('overview')}
              icon={<Layers size={16} />}
              label={t('AppsDetailView.tabOverview')}
            />
            {canManageVersions ? (
              <TabButton
                active={showStore}
                onClick={() => setActiveTab('store')}
                icon={<ShoppingBag size={16} />}
                label={t('AppsDetailView.tabStore')}
                badge={
                  banner === 'no_submission' || banner === 'pending' ? (
                    <span className="w-2 h-2 rounded-full bg-orange-400" />
                  ) : null
                }
              />
            ) : null}
          </div>

          {showStore ? (
            <StoreTab
              app={app}
              banner={banner}
              versionOptions={versionOptions}
              approvalByVersion={approvalByVersion}
              isOwner={isOwner}
              isAdmin={isAdmin}
              isTogglingPrivacy={detail.isTogglingPrivacy}
              withdrawingVersion={detail.withdrawingVersion}
              onTogglePrivacy={() => void detail.togglePrivacy()}
              onSubmitVersion={openSubmitModal}
              onWithdrawVersion={(version) => void detail.withdrawVersion(version)}
            />
          ) : (
            <OverviewTab
              app={app}
              versionOptions={versionOptions}
              selectedVersion={effectiveVersion}
              versionInfo={toVersionInfo(versionDetails)}
              hasVersionInfo={hasInfo(versionDetails)}
              canDeploy={isStaff}
              runtimeStatus={{
                runtime: versionRuntime.runtime,
                isLoading: versionRuntime.isLoading,
                errorKey: versionRuntime.errorKey,
              }}
              credentialsMissing={needsCredential(gate)}
              deployEnabled={canStartDeployment(gate)}
              scrollToDeployOptions={hash === DEPLOYMENT_OPTIONS_HASH}
              onSelectVersion={setSelectedVersion}
              onDeploy={startDeployment}
            />
          )}
        </div>
      ) : null}

      {app ? (
        <>
          <Modal
            show={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            title={t('AppsDetailView.confirmDeleteTitle')}
            body={
              <div className="space-y-3">
                <p className="text-textMuted">
                  <BoldSlot i18nKey="AppsDetailView.confirmDeleteMessage" slot="name" value={app.name} />
                </p>
              </div>
            }
            footer={
              <div className="flex justify-end gap-3">
                <BaseButton variant="text" onClick={() => setShowDeleteModal(false)} disabled={detail.isDeleting}>
                  {t('AppsDetailView.cancelButton')}
                </BaseButton>
                <BaseButton
                  variant="destructive"
                  onClick={async () => {
                    if (await detail.deleteApp()) setShowDeleteModal(false)
                  }}
                  disabled={detail.isDeleting}
                >
                  {detail.isDeleting ? t('AppsDetailView.deletingButton') : t('AppsDetailView.confirmButton')}
                </BaseButton>
              </div>
            }
          />

          <EditAppModal
            show={showEditModal}
            app={app}
            isSaving={detail.isSavingEdit}
            onClose={() => setShowEditModal(false)}
            onSave={async (form, image) => {
              if (await detail.saveEdit(form, image)) setShowEditModal(false)
            }}
          />
        </>
      ) : null}

      <SubmitVersionModal
        versionTag={submitTarget}
        isSubmitting={detail.isSubmitting}
        markerErrors={detail.markerErrors}
        onClose={() => setSubmitTarget(null)}
        onSubmit={(notes) => void submitVersion(notes)}
      />
    </div>
  )
}
