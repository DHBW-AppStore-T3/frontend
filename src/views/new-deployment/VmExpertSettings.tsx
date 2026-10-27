import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import type { DeploymentDraft, NetworkSelection, ResourceChoice } from '@/types'
import { networkValue, visibleNetworkKeys, workloadCount } from '@/utils/network'
import { formatMemoryGb, isDefaultSelection, totalResources } from '@/utils/resources'
import NetworkSwitchRow from './NetworkSwitchRow'
import VmResourceSliders from './VmResourceSliders'
import './VmSettings.css'

type Selection = Record<string, { cpu: string; memory: string }>

interface Props {
  draft: Pick<DeploymentDraft, 'scope' | 'studentIds' | 'groupNames' | 'groupCount' | 'networkChoices' | 'network'>
  choices: ResourceChoice[]
  resources: Selection
  onResourcesChange: (next: Selection) => void
  onNetworkChange: (next: NetworkSelection) => void
}

/**
 * "Expert settings" of a Windows VM: compute resources and networked desktops. Closed by default;
 * the closed header says what applies ("Recommended · 4 vCPU · 8 GB RAM"), so nothing is hidden.
 */
export default function VmExpertSettings({ draft, choices, resources, onResourcesChange, onNetworkChange }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const headId = useId()
  const bodyId = useId()
  const showResources = choices.length > 0
  const showPods = visibleNetworkKeys(draft).includes('podNetwork')
  if (!showResources && !showPods) return null

  const changed = showResources && !isDefaultSelection(choices, resources)
  const total = totalResources(choices, resources)
  // One machine per person: only then "people" is the right count for the total.
  const people = draft.scope === 'user' ? workloadCount(draft) : undefined

  return (
    <section
      className="vm-expert rounded-xl border border-borderSubtle bg-surface shadow-sm"
      data-testid="vm-expert-settings"
      data-open={open}
      data-changed={changed}
    >
      <button
        id={headId}
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 rounded-xl px-6 py-4 text-left hover:bg-surfaceMuted/40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        <span
          className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-primaryFaint text-primaryDeep"
          aria-hidden="true"
        >
          <SlidersHorizontal size={20} />
        </span>
        <span className="grid min-w-0 flex-1 gap-2">
          <span className="text-base font-bold text-textHeading">{t('deployment.network.title')}</span>
          {showResources ? (
            <span className="flex flex-wrap items-center gap-2.5">
              <span
                data-testid="vm-expert-chip"
                data-changed={changed}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                  changed ? 'bg-primaryFaint text-primaryDeep' : 'bg-surfaceMuted text-textStrong'
                }`}
              >
                {changed ? <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" /> : null}
                {t(changed ? 'deployment.vm.expert.changed' : 'deployment.vm.expert.recommended')}
              </span>
              <span
                data-testid="vm-expert-plate"
                className="inline-flex items-stretch rounded-md border border-borderSubtle bg-surfacePage tabular-nums"
              >
                <span className="inline-flex items-baseline gap-1.5 px-3 py-0.5">
                  <b className={`text-base font-extrabold ${changed ? 'text-primaryDark' : 'text-textHeading'}`}>
                    {total.cpuMillicores / 1000}
                  </b>
                  <span className="text-xs font-bold uppercase tracking-wider text-textStrong">{t('deployment.vm.expert.cpuUnit')}</span>
                </span>
                <span className="inline-flex items-baseline gap-1.5 border-l border-borderSubtle px-3 py-0.5">
                  <b className={`text-base font-extrabold ${changed ? 'text-primaryDark' : 'text-textHeading'}`}>
                    {formatMemoryGb(total.memoryMib)}
                  </b>
                  <span className="text-xs font-bold uppercase tracking-wider text-textStrong">{t('deployment.vm.expert.ramUnit')}</span>
                </span>
              </span>
            </span>
          ) : null}
        </span>
        <ChevronDown size={20} className="vm-expert__chev" aria-hidden="true" />
      </button>

      <div className="vm-expert__panel">
        <div className="vm-expert__clip">
          <div
            id={bodyId}
            role="region"
            aria-labelledby={headId}
            aria-hidden={open ? undefined : true}
            inert={!open}
            data-testid="vm-expert-settings-body"
            className="border-t border-borderSubtle px-6 pb-6"
          >
            {showResources ? (
              <VmResourceSliders choices={choices} value={resources} onChange={onResourcesChange} people={people} />
            ) : null}
            {showPods ? (
              <div className={showResources ? 'mt-6 border-t border-borderSubtle pt-6' : 'pt-6'}>
                <NetworkSwitchRow
                  label={t('deployment.vm.pods.label')}
                  help={t('deployment.vm.pods.help')}
                  checked={networkValue(draft, 'podNetwork')}
                  onChange={(value) => onNetworkChange({ ...(draft.network ?? {}), podNetwork: value })}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
