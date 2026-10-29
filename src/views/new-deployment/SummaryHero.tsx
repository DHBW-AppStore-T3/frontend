import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Package } from 'lucide-react'
import BoldSlot from '@/i18n/BoldSlot'
import type { DeploymentRuntime } from '@/types'
import { runtimeLabelKey } from '@/utils/runtime'
import { CardBadge, EditButton } from './SummaryCard'

interface Props {
  /** ``null`` when the app of the draft is not in the list. */
  appName: string | null
  appImage?: string | null
  deploymentName: string
  people: number
  version: string
  runtime: DeploymentRuntime | null | undefined
  onEdit: () => void
}

/** "Das wird gestartet": one sentence that says what the click on "Deployen" does, then name, version, runtime. */
export default function SummaryHero({ appName, appImage, deploymentName, people, version, runtime, onEdit }: Props) {
  const { t } = useTranslation()
  const titleId = useId()

  return (
    <section className="summary-card summary-hero" aria-labelledby={titleId} data-testid="summary-hero">
      <div className="summary-hero__top">
        <CardBadge>
          {appImage ? <img src={appImage} alt="" className="h-full w-full rounded-lg object-contain" /> : <Package size={20} />}
        </CardBadge>
        <span className="summary-micro summary-hero__eyebrow">{t('deployment.summary.hero.eyebrow')}</span>
        <EditButton label={t('deployment.summary.edit.start')} onClick={onEdit} />
        <h2 id={titleId} className="summary-hero__title">
          {t('deployment.summary.hero.title', { app: appName ?? t('deployment.summary.appNotFound'), count: people })}
        </h2>
        <p className="summary-hero__name">
          <BoldSlot i18nKey="deployment.summary.hero.name" slot="name" value={deploymentName || '-'} />
        </p>
      </div>

      <div className="summary-plate" role="group" aria-label={t('deployment.summary.hero.facts')}>
        <div className="summary-plate__cell">
          <span className="summary-micro block">{t('deployment.summary.versionLabel')}</span>
          <span className="summary-plate__value">{version}</span>
        </div>
        <div className="summary-plate__cell" data-testid="summary-runtime">
          <span className="summary-micro block">{t('deployment.summary.runtimeLabel')}</span>
          <span className="summary-plate__value">{t(runtimeLabelKey(runtime))}</span>
        </div>
      </div>
    </section>
  )
}
