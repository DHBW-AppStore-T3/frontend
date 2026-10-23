import { useTranslation } from 'react-i18next'
import { Boxes, Monitor } from 'lucide-react'
import type { AppRuntime } from '@/types'
import { runtimeLabelKey } from './runtime'

export interface RuntimeStatusProps {
  runtime: AppRuntime | null
  isLoading: boolean
  /** Translation key of the load error, if any. */
  errorKey: string | null
}

const POD_TONE = 'bg-emerald-50 text-emerald-800 border-emerald-200'
const VM_TONE = 'bg-indigo-50 text-indigo-800 border-indigo-200'

/** How the selected version runs: pods in the cluster, or a VM (Windows). */
export default function RuntimeStatus({ runtime, isLoading, errorKey }: RuntimeStatusProps) {
  const { t } = useTranslation()
  const isPod = runtime?.runtime === 'kubernetes'

  return (
    <div className="mb-4 text-sm" data-testid="version-runtime">
      {isLoading ? (
        <span className="text-textFaint">{t('AppsDetailView.runtime.loading')}</span>
      ) : errorKey ? (
        <span className="text-danger">{t(errorKey)}</span>
      ) : runtime ? (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-semibold ${isPod ? POD_TONE : VM_TONE}`}
        >
          {isPod ? <Boxes size={14} /> : <Monitor size={14} />}
          {t(runtimeLabelKey(runtime.runtime))}
          {runtime.scope === 'user' ? (
            <span className="font-normal">· {t('AppsDetailView.runtime.perPerson')}</span>
          ) : null}
        </span>
      ) : null}
    </div>
  )
}
