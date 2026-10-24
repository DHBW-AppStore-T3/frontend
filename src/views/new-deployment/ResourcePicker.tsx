import { useTranslation } from 'react-i18next'
import { Cpu } from 'lucide-react'
import type { ResourceChoice } from '@/types'
import {
  CPU_STEP_MILLICORES,
  MEMORY_STEP_MIB,
  cpuToMillicores,
  formatCpu,
  formatMemory,
  memoryToMib,
  steps,
} from '@/utils/resources'

interface Props {
  choices: ResourceChoice[]
  value: Record<string, { cpu: string; memory: string }>
  onChange: (next: Record<string, { cpu: string; memory: string }>) => void
}

/** vCPU and RAM of the containers an app lets people size; the app's own values are the defaults. */
export default function ResourcePicker({ choices, value, onChange }: Props) {
  const { t } = useTranslation()

  const set = (container: string, key: 'cpu' | 'memory', v: string) =>
    onChange({ ...value, [container]: { ...value[container]!, [key]: v } })

  return (
    <div
      className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border-2 border-emerald-200 overflow-hidden"
      data-testid="resource-picker"
    >
      <div className="bg-emerald-600 text-white px-6 py-4 flex items-center gap-3">
        <Cpu size={24} />
        <div>
          <h2 className="text-xl font-bold">{t('deployment.resources.title')}</h2>
          <p className="text-xs text-emerald-100 mt-0.5">{t('deployment.resources.desc')}</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {choices.map((c) => {
          const chosen = value[c.container] ?? { cpu: c.cpu.default, memory: c.memory.default }
          const cpuMin = cpuToMillicores(c.cpu.min)
          const cpuMax = cpuToMillicores(c.cpu.max)
          const memMin = memoryToMib(c.memory.min)
          const memMax = memoryToMib(c.memory.max)
          return (
            <div key={c.container} className="space-y-4">
              {choices.length > 1 ? (
                <div className="text-sm font-semibold text-emerald-900">
                  {t('deployment.resources.container')}: <code className="font-mono">{c.container}</code>
                </div>
              ) : null}

              <label className="block">
                <div className="flex justify-between text-sm font-medium text-textHeading">
                  <span>{t('deployment.resources.cpu')}</span>
                  <span data-testid={`cpu-${c.container}`}>
                    {t('deployment.resources.vcpu', { count: cpuToMillicores(chosen.cpu) / 1000 })}
                  </span>
                </div>
                <input
                  type="range"
                  className="w-full accent-emerald-600"
                  min={cpuMin}
                  max={cpuMax}
                  step={CPU_STEP_MILLICORES}
                  list={`cpu-${c.container}-ticks`}
                  value={cpuToMillicores(chosen.cpu)}
                  aria-label={t('deployment.resources.cpu')}
                  onChange={(e) => set(c.container, 'cpu', formatCpu(Number(e.target.value)))}
                />
                <datalist id={`cpu-${c.container}-ticks`}>
                  {steps(cpuMin, cpuMax, CPU_STEP_MILLICORES).map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
                <div className="text-xs text-textFaint">
                  {t('deployment.resources.range', { min: c.cpu.min, max: c.cpu.max, default: c.cpu.default })}
                </div>
              </label>

              <label className="block">
                <div className="flex justify-between text-sm font-medium text-textHeading">
                  <span>{t('deployment.resources.memory')}</span>
                  <span data-testid={`memory-${c.container}`}>{formatMemory(memoryToMib(chosen.memory))}</span>
                </div>
                <input
                  type="range"
                  className="w-full accent-emerald-600"
                  min={memMin}
                  max={memMax}
                  step={MEMORY_STEP_MIB}
                  value={memoryToMib(chosen.memory)}
                  aria-label={t('deployment.resources.memory')}
                  onChange={(e) => set(c.container, 'memory', formatMemory(Number(e.target.value)))}
                />
                <div className="text-xs text-textFaint">
                  {t('deployment.resources.range', { min: c.memory.min, max: c.memory.max, default: c.memory.default })}
                </div>
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}
