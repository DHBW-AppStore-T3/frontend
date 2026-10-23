import { useTranslation } from 'react-i18next'
import type { AppVersionApproval } from '@/types'

const COMMIT_LENGTH = 12
const DIGEST_LENGTH = 19

/**
 * What a review covers: exactly this commit and, for pods, this appstore.yaml
 * and these images. A version submitted without a commit cannot be pinned.
 */
export default function ReviewScope({ approval }: { approval: AppVersionApproval }) {
  const { t } = useTranslation()

  return (
    <dl className="mt-1.5 space-y-0.5 text-[11px] text-textMuted" data-testid="review-scope">
      <div className="flex gap-1">
        <dt className="font-medium">{t('AdminAppsView.runtimeLabel')}</dt>
        <dd>{approval.runtime === 'kubernetes' ? t('runtime.kubernetes') : t('runtime.openstackVm')}</dd>
      </div>
      {approval.commit_sha ? (
        <div className="flex gap-1">
          <dt className="font-medium">{t('AdminAppsView.commitLabel')}</dt>
          <dd className="font-mono" title={approval.commit_sha}>
            {approval.commit_sha.slice(0, COMMIT_LENGTH)}
          </dd>
        </div>
      ) : (
        <div className="text-warning">{t('AdminAppsView.notPinned')}</div>
      )}
      {approval.spec_sha256 ? (
        <div className="flex gap-1">
          <dt className="font-medium">{t('AdminAppsView.specLabel')}</dt>
          <dd className="font-mono" title={approval.spec_sha256}>
            {approval.spec_sha256.slice(0, COMMIT_LENGTH)}
          </dd>
        </div>
      ) : null}
      {approval.image_digests?.length ? (
        <div className="flex gap-1">
          <dt className="font-medium shrink-0">{t('AdminAppsView.imagesLabel')}</dt>
          <dd className="font-mono break-all">
            {approval.image_digests.map((digest) => (
              <span key={digest} className="block" title={digest}>
                {digest.slice(0, DIGEST_LENGTH)}…
              </span>
            ))}
          </dd>
        </div>
      ) : null}
    </dl>
  )
}
