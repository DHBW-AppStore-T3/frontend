import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Layers } from 'lucide-react'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import { formatDate } from '@/utils/format'
import { safeHttpUrl } from '@/utils/safe-url'
import RuntimeStatus, { type RuntimeStatusProps } from './RuntimeStatus'
import { paths } from '@/router/paths'
import { deployVersionOf, type AppDetail, type VersionInfo } from './versionInfo'

export interface OverviewTabProps {
  app: AppDetail
  versionOptions: string[]
  selectedVersion: string
  versionInfo: VersionInfo | null
  hasVersionInfo: boolean
  /** Teachers and admins deploy; students use deployments. */
  canDeploy: boolean
  /** How the selected version runs, shown above the deploy button. */
  runtimeStatus: RuntimeStatusProps
  /** The version is a VM app and the caller has no usable OpenStack credential. */
  credentialsMissing: boolean
  /** The caller may press "Deploy" now. */
  deployEnabled: boolean
  /** Scroll to (and focus) the deployment options once, e.g. when arriving from "Deploy". */
  scrollToDeployOptions: boolean
  onSelectVersion: (version: string) => void
  onDeploy: () => void
  /** Admin view: show the version select and "Set version" instead of "Deploy". */
  showVersionSelect: boolean
  /** The version an admin fixed for teachers, if any. */
  deployVersion: string | null
  /** Why "Set version" is disabled right now. */
  setDeployVersionDisabledReason: 'busy' | 'same' | 'not_approved' | null
  onSetDeployVersion: () => void
}

const CARD = 'bg-surfaceMuted rounded-lg p-4 border border-borderSubtle'
const CARD_TITLE = 'text-sm font-semibold text-textMuted uppercase tracking-wide mb-2'

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-textMuted">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}

export default function OverviewTab(props: OverviewTabProps) {
  const { app, versionOptions, selectedVersion, versionInfo, hasVersionInfo, credentialsMissing } = props
  const { t, i18n } = useTranslation()
  const deployRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!props.scrollToDeployOptions) return
    deployRef.current?.scrollIntoView?.({ block: 'center' })
    deployRef.current?.querySelector('select')?.focus({ preventScroll: true })
  }, [props.scrollToDeployOptions])

  const prerelease = String(versionInfo?.prerelease ?? '').toLowerCase() === 'true'
    ? t('AppsDetailView.yes')
    : versionInfo?.prerelease === ''
      ? '-'
      : t('AppsDetailView.no')

  return (
    <div className="app-detail-grid">
      <div className="detail-surface space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-textHeading mb-3">{t('AppsDetailView.descriptionTitle')}</h2>
          {app.description && app.description.trim() ? (
            <MarkdownRenderer source={app.description} variant="full" />
          ) : (
            <p lang={i18n.language} className="text-textMuted italic">
              {t('AppsDetailView.noDescription')}
            </p>
          )}
        </div>

        <div className={CARD}>
          <h3 className={CARD_TITLE}>{t('AppsDetailView.appInfoTitle')}</h3>
          <div className="space-y-2 text-sm text-textMuted">
            <InfoRow
              label={t('AppsDetailView.createdAt')}
              value={app.created_at ? formatDate(app.created_at) : '-'}
            />
            <InfoRow
              label={t('AppsDetailView.createdBy')}
              value={app.user?.username || t('AppsDetailView.unknownUser')}
            />
          </div>
        </div>

        <div className={CARD}>
          <h3 className={CARD_TITLE}>{t('AppsDetailView.versionDetailsTitle')}</h3>
          {hasVersionInfo && versionInfo ? (
            <div className="space-y-2 text-sm">
              <InfoRow label={t('AppsDetailView.versionName')} value={versionInfo.name || '-'} />
              <InfoRow label={t('AppsDetailView.versionType')} value={versionInfo.type || '-'} />
              <InfoRow label={t('AppsDetailView.versionCommit')} value={versionInfo.commit || '-'} />
              <InfoRow label={t('AppsDetailView.versionAuthor')} value={versionInfo.author || '-'} />
              <InfoRow
                label={t('AppsDetailView.versionPublishedAt')}
                value={versionInfo.published_at ? formatDate(versionInfo.published_at) : '-'}
              />
              <InfoRow label={t('AppsDetailView.versionPreRelease')} value={prerelease} />
              <div className="flex justify-between items-center">
                <span className="text-textMuted">{t('AppsDetailView.versionLink')}</span>
                {versionInfo.html_url ? (
                  <a
                    href={safeHttpUrl(versionInfo.html_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-info hover:underline break-all"
                  >
                    {versionInfo.html_url}
                  </a>
                ) : (
                  <span className="font-medium text-right">-</span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-textFaint">{t('AppsDetailView.noVersionInfo')}</p>
          )}
        </div>

        {versionInfo?.description ? (
          <div className={CARD}>
            <h3 className={CARD_TITLE}>{t('AppsDetailView.versionDescTitle')}</h3>
            <MarkdownRenderer source={versionInfo.description} variant="full" />
          </div>
        ) : null}
      </div>

      {/* Deploy sidebar */}
      {props.canDeploy ? (
      <div id="deployment-options" ref={deployRef} className="detail-surface deployment-options">
        <h2 className="text-lg font-semibold text-textHeading mb-6">{t('AppsDetailView.startDeploymentTitle')}</h2>

        {props.showVersionSelect ? (
        <div className="mb-6">
          <label className="block text-sm font-medium text-textMuted mb-2">
            {t('AppsDetailView.selectVersionLabel')}
          </label>
          <select
            value={selectedVersion}
            onChange={(e) => props.onSelectVersion(e.target.value)}
            disabled={versionOptions.length === 0}
            className="w-full rounded-lg border border-borderSubtle bg-white py-2 px-3 text-sm text-textHeading focus:ring-2 focus:ring-primary focus:border-primary shadow-sm cursor-pointer transition-all hover:border-textFaint"
          >
            {versionOptions.map((ver) => (
              <option key={ver} value={ver}>
                {ver}
              </option>
            ))}
          </select>
          <p className="mt-2 text-sm text-textMuted">
            {props.deployVersion
              ? t('AppsDetailView.deployVersionCurrent', { version: props.deployVersion })
              : t('AppsDetailView.deployVersionNone', { version: deployVersionOf(app, versionOptions) })}
          </p>
        </div>
        ) : null}

        <RuntimeStatus {...props.runtimeStatus} />

        <button
          type="button"
          onClick={props.showVersionSelect ? props.onSetDeployVersion : props.onDeploy}
          disabled={props.showVersionSelect ? props.setDeployVersionDisabledReason !== null : !props.deployEnabled}
          title={
            props.showVersionSelect
              ? props.setDeployVersionDisabledReason === 'not_approved'
                ? t('AppsDetailView.setDeployVersionNotApproved')
                : ''
              : credentialsMissing
                ? t('AppsDetailView.missingCredsTitle')
                : ''
          }
          className="w-full bg-gradient-to-r from-primaryAction to-primaryActionHover text-white px-4 py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          <Layers size={18} />
          {props.showVersionSelect ? t('AppsDetailView.setDeployVersionButton') : t('AppsDetailView.deployButton')}
        </button>
        {!props.showVersionSelect && credentialsMissing ? (
          <p className="mt-2 text-sm text-amber-700">
            <Link to={paths.userOpenStack} className="underline font-medium">
              {t('AppsDetailView.missingCredsLink')}
            </Link>{' '}
            {t('AppsDetailView.missingCredsText')}
          </p>
        ) : null}
      </div>
      ) : null}
    </div>
  )
}
