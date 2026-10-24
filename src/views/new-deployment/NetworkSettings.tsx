import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, TriangleAlert } from 'lucide-react'
import Toggle from '@/views/add-app/Toggle'
import type { DeploymentDraft, NetworkSelection } from '@/types'
import { networkValue, visibleNetworkKeys } from '@/utils/network'

interface Props {
  draft: Pick<
    DeploymentDraft,
    'scope' | 'studentIds' | 'assignments' | 'groupCount' | 'networkChoices' | 'network'
  >
  onChange: (next: NetworkSelection) => void
}

/**
 * Collapsible "expert settings" below the resources: internet access and
 * networked pods, only what the app author allowed. Closed by default.
 */
export default function NetworkSettings({ draft, onChange }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const keys = visibleNetworkKeys(draft)
  if (keys.length === 0) return null

  const Chevron = open ? ChevronUp : ChevronDown
  const set = (key: 'internet' | 'podNetwork', value: boolean) =>
    onChange({ ...(draft.network ?? {}), [key]: value })

  return (
    <div className="rounded-xl border-2 border-borderSubtle bg-white overflow-hidden" data-testid="network-settings">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-6 py-4 text-left font-semibold text-textHeading hover:bg-surfaceMuted"
      >
        <span>{t('deployment.network.title')}</span>
        <Chevron size={18} />
      </button>

      {open ? (
        <div className="px-6 pb-6 space-y-5 border-t border-borderSubtle pt-4" data-testid="network-settings-body">
          {keys.map((key) => {
            const on = networkValue(draft, key)
            return (
              <div key={key}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-textHeading">{t(`deployment.network.${key}.label`)}</div>
                    <p className="text-xs text-textFaint mt-0.5">{t(`deployment.network.${key}.help`)}</p>
                  </div>
                  <Toggle checked={on} onChange={(v) => set(key, v)} label={t(`deployment.network.${key}.label`)} />
                </div>
                {key === 'internet' && on ? (
                  <p
                    role="alert"
                    className="mt-2 flex items-start gap-2 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800"
                    data-testid="network-internet-warning"
                  >
                    <TriangleAlert size={14} className="mt-0.5 flex-shrink-0" />
                    {t('deployment.network.internet.warning')}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
