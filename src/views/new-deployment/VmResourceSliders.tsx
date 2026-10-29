import { useId, useRef, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw, Users } from 'lucide-react'
import type { ResourceChoice } from '@/types'
import {
  cpuToMillicores,
  defaultSelection,
  formatCpu,
  formatMemory,
  formatMemoryGb,
  isDefaultSelection,
  memoryToMib,
  steps,
  totalResources,
} from '@/utils/resources'
import './VmSettings.css'

type Selection = Record<string, { cpu: string; memory: string }>

interface Props {
  choices: ResourceChoice[]
  value: Selection
  onChange: (next: Selection) => void
  /** How many machines run (one per person): shows what all of them need together. */
  people?: number
}

// A VM is sized in whole vCPUs and whole GiB.
const CPU_STEP_MILLICORES = 1000
const MEMORY_STEP_MIB = 1024
const MEMORY_LABEL_EVERY_GB = 4

interface DialProps {
  inputId: string
  testKey: string
  label: string
  unit: string
  readout: string
  min: number
  max: number
  step: number
  value: number
  recommended: number
  tickLabel: (v: number) => string
  labelled: (v: number) => boolean
  spoken: (v: number, recommended: boolean) => string
  onChange: (v: number) => void
  inputRef?: React.Ref<HTMLInputElement>
}

/** One slider: a large readout, a notch per step and a marker where the app recommends to stay. */
function Dial({
  inputRef,
  inputId,
  testKey,
  label,
  unit,
  readout,
  min,
  max,
  step,
  value,
  recommended,
  tickLabel,
  labelled,
  spoken,
  onChange,
}: DialProps) {
  const { t } = useTranslation()
  const changed = value !== recommended
  const fill = (value - min) / (max - min)
  return (
    <div data-testid={`dial-${testKey}`} data-changed={changed}>
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={inputId} className="pb-1.5 text-sm font-semibold text-textHeading">
          {label}
        </label>
        <output htmlFor={inputId} data-testid={testKey} className="vm-readout inline-flex items-baseline gap-1.5 tabular-nums">
          <b key={readout} className={`text-headline-1 font-extrabold tracking-tight ${changed ? 'text-primary' : 'text-textHeading'}`}>
            {readout}
          </b>
          <span className="text-xs font-bold uppercase tracking-wider text-textStrong">{unit}</span>
        </output>
      </div>
      <div className="vm-slider" style={{ '--p': fill } as CSSProperties}>
        <input
          ref={inputRef}
          id={inputId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={spoken(value, !changed)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <div className="vm-ticks" aria-hidden="true">
          {steps(min, max, step).map((v) => {
            const isRecommended = v === recommended
            const showLabel = isRecommended || labelled(v)
            return (
              <span
                key={v}
                className="vm-tick"
                data-testid={`tick-${testKey}`}
                data-recommended={isRecommended}
                data-quiet={!showLabel}
                style={{ '--t': (v - min) / (max - min) } as CSSProperties}
              >
                <span className="vm-tick__mark" />
                {showLabel ? <span>{tickLabel(v)}</span> : null}
                {isRecommended ? <small className="vm-tick__rec">{t('deployment.vm.resources.recommendedTick')}</small> : null}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * vCPU and memory of a VM for people who do not think in "millicores": the recommendation is
 * preselected and visible on the slider, a changed value shows up red, one click goes back.
 */
export default function VmResourceSliders({ choices, value, onChange, people }: Props) {
  const { t } = useTranslation()
  const baseId = useId()
  const firstSlider = useRef<HTMLInputElement>(null)
  const changed = !isDefaultSelection(choices, value)

  const set = (c: ResourceChoice, key: 'cpu' | 'memory', v: string) =>
    onChange({ ...value, [c.container]: { ...(value[c.container] ?? { cpu: c.cpu.default, memory: c.memory.default }), [key]: v } })

  const reset = () => {
    onChange({ ...value, ...defaultSelection(choices) })
    firstSlider.current?.focus()
  }

  const total = totalResources(choices, value)
  const cpuTotal = (total.cpuMillicores * (people ?? 0)) / 1000
  const memoryTotal = formatMemoryGb(total.memoryMib * (people ?? 0))

  return (
    <section aria-labelledby={`${baseId}-title`} data-testid="vm-resource-sliders">
      <div className="flex flex-col items-start justify-between gap-2.5 pt-5 sm:flex-row sm:gap-4">
        <div>
          <h3 id={`${baseId}-title`} className="text-sm font-bold text-textHeading">
            {t('deployment.resources.title')}
          </h3>
          <p className="mt-0.5 max-w-md text-sm text-textStrong">{t('deployment.vm.resources.desc')}</p>
        </div>
        {changed ? (
          <button
            type="button"
            onClick={reset}
            className="-ml-2.5 inline-flex flex-none items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold text-primaryDark hover:bg-primaryFaint focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:-mr-2.5 sm:ml-0"
          >
            <RotateCcw size={14} aria-hidden="true" />
            {t('deployment.vm.expert.reset')}
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-7">
        {choices.map((c, index) => {
          const chosen = value[c.container] ?? { cpu: c.cpu.default, memory: c.memory.default }
          const cpuMin = cpuToMillicores(c.cpu.min)
          const memMin = memoryToMib(c.memory.min)
          return (
            <div key={c.container} className="grid gap-7">
              {choices.length > 1 ? (
                <div className="text-sm font-semibold text-textHeading">
                  {t('deployment.resources.container')}: <code className="font-mono">{c.container}</code>
                </div>
              ) : null}
              <Dial
                inputRef={index === 0 ? firstSlider : undefined}
                inputId={`${baseId}-${c.container}-cpu`}
                testKey={`cpu-${c.container}`}
                label={t('deployment.vm.resources.cpu')}
                unit={t('deployment.vm.resources.cpuUnit')}
                readout={String(cpuToMillicores(chosen.cpu) / 1000)}
                min={cpuMin}
                max={cpuToMillicores(c.cpu.max)}
                step={CPU_STEP_MILLICORES}
                value={cpuToMillicores(chosen.cpu)}
                recommended={cpuToMillicores(c.cpu.default)}
                tickLabel={(v) => String(v / 1000)}
                labelled={() => true}
                spoken={(v, rec) => {
                  const text = t('deployment.vm.resources.cpuValue', { count: v / 1000 })
                  return rec ? t('deployment.vm.resources.recommendedValue', { value: text }) : text
                }}
                onChange={(v) => set(c, 'cpu', formatCpu(v))}
              />
              <Dial
                inputId={`${baseId}-${c.container}-memory`}
                testKey={`memory-${c.container}`}
                label={t('deployment.resources.memory')}
                unit={t('deployment.vm.resources.memoryUnit')}
                readout={formatMemoryGb(memoryToMib(chosen.memory))}
                min={memMin}
                max={memoryToMib(c.memory.max)}
                step={MEMORY_STEP_MIB}
                value={memoryToMib(chosen.memory)}
                recommended={memoryToMib(c.memory.default)}
                tickLabel={(v) => formatMemoryGb(v)}
                labelled={(v) => ((v - memMin) / MEMORY_STEP_MIB) % MEMORY_LABEL_EVERY_GB === 0}
                spoken={(v, rec) => {
                  const text = t('deployment.vm.resources.memoryValue', { count: Number(formatMemoryGb(v)) })
                  return rec ? t('deployment.vm.resources.recommendedValue', { value: text }) : text
                }}
                onChange={(v) => set(c, 'memory', formatMemory(v))}
              />
            </div>
          )
        })}
      </div>

      {people != null && people > 0 ? (
        <p
          data-testid="vm-total"
          className="mt-6 flex items-center gap-2.5 rounded-md bg-surfaceMuted px-3.5 py-2.5 text-sm text-textStrong"
        >
          <Users size={16} className="flex-none" aria-hidden="true" />
          <span>
            {t('deployment.vm.resources.totalLabel', { count: people })}:{' '}
            <b className="whitespace-nowrap font-bold tabular-nums text-textHeading">
              {cpuTotal} {t('deployment.vm.expert.cpuUnit')}
            </b>{' '}
            ·{' '}
            <b className="whitespace-nowrap font-bold tabular-nums text-textHeading">
              {memoryTotal} {t('deployment.vm.expert.ramUnit')}
            </b>
          </span>
        </p>
      ) : null}
    </section>
  )
}
