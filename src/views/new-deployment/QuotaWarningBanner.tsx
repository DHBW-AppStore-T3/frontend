import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { QuotaRow } from '@/composables/useQuotas'

interface Props {
  warnings: QuotaRow[]
}

export default function QuotaWarningBanner({ warnings }: Props) {
  const { t } = useTranslation()

  if (warnings.length === 0) return null

  return (
    <div
      className="mb-6 flex gap-3 rounded-xl border border-warning/40 bg-warningTint p-4"
      role="alert"
      data-testid="quota-warning-banner"
    >
      <AlertTriangle size={20} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
      <div>
        <p className="font-semibold text-amber-900">{t('deployment.config.quotaWarning.title')}</p>
        <ul className="mt-1 list-inside list-disc text-sm text-amber-800">
          {warnings.map((w) => (
            <li key={w.label}>
              {w.label}:{' '}
              <strong>
                {t('deployment.config.quotaWarning.usage', {
                  percentage: w.percentage,
                  used: w.used,
                  limit: w.limit,
                  unit: w.unit,
                })}
              </strong>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-amber-800">{t('deployment.config.quotaWarning.hint')}</p>
      </div>
    </div>
  )
}
