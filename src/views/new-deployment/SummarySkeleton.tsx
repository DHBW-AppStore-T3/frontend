import { useTranslation } from 'react-i18next'
import './SummaryCards.css'

const WIDTHS = [60, 80, 70]

/** The three cards while the definitions load: the page keeps its shape instead of jumping. */
export default function SummarySkeleton() {
  const { t } = useTranslation()
  return (
    <>
      <span className="sr-only">{t('deployment.summary.loadingConfig')}</span>
      {WIDTHS.map((width) => (
        <div key={width} className="summary-card summary-skeleton" data-testid="summary-skeleton" aria-hidden="true">
          <i style={{ width: `${width}%` }} />
          <i style={{ width: `${width - 25}%` }} />
          <i style={{ width: `${width - 10}%` }} />
        </div>
      ))}
    </>
  )
}
