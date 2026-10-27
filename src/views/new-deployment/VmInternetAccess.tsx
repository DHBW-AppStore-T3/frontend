import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Lock, TriangleAlert } from 'lucide-react'
import Toggle from '@/views/add-app/Toggle'
import type { DeploymentDraft, NetworkSelection } from '@/types'
import { networkValue, visibleNetworkKeys } from '@/utils/network'

interface Props {
  draft: Pick<DeploymentDraft, 'scope' | 'studentIds' | 'groupNames' | 'groupCount' | 'networkChoices' | 'network'>
  onChange: (next: NetworkSelection) => void
}

/**
 * Internet access of a Windows VM: a decision every lecturer should see, so it never hides behind
 * "expert settings". The state and what it means for the students stand next to the switch.
 */
export default function VmInternetAccess({ draft, onChange }: Props) {
  const { t } = useTranslation()
  const titleId = useId()
  if (!visibleNetworkKeys(draft).includes('internet')) return null

  const on = networkValue(draft, 'internet')
  const set = (value: boolean) => onChange({ ...(draft.network ?? {}), internet: value })
  const NoteIcon = on ? TriangleAlert : Lock

  return (
    <section
      className="rounded-xl border border-borderSubtle bg-surface px-6 py-5 shadow-sm"
      data-testid="vm-internet-access"
      aria-labelledby={titleId}
    >
      <div className="flex flex-wrap items-start gap-4 sm:flex-nowrap">
        <span
          className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-primaryFaint text-primaryDeep"
          aria-hidden="true"
        >
          <Globe size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-base font-bold text-textHeading">
            {t('deployment.vm.internet.label')}
          </h2>
          <p className="mt-0.5 max-w-md text-sm text-textStrong">{t('deployment.vm.internet.help')}</p>
        </div>
        <div className="flex w-full items-center justify-between gap-3 pt-1.5 sm:w-auto sm:justify-start">
          <span
            data-testid="vm-internet-state"
            data-on={on}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
              on ? 'bg-primaryFaint text-primaryDeep' : 'bg-surfaceMuted text-textStrong'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {t(on ? 'deployment.vm.internet.stateOn' : 'deployment.vm.internet.stateOff')}
          </span>
          <Toggle checked={on} onChange={set} label={t('deployment.vm.internet.label')} />
        </div>
      </div>

      <p
        role="status"
        data-testid="vm-internet-note"
        data-tone={on ? 'warn' : 'calm'}
        className={`mt-4 flex items-start gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium ${
          on ? 'bg-warningTint text-warning ring-1 ring-inset ring-warning/20' : 'bg-surfaceMuted text-textStrong'
        }`}
      >
        <NoteIcon size={16} className="mt-0.5 flex-none" aria-hidden="true" />
        <span>{t(on ? 'deployment.vm.internet.noteOn' : 'deployment.vm.internet.noteOff')}</span>
      </p>
    </section>
  )
}
