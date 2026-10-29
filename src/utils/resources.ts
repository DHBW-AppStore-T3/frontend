import type { ResourceChoice } from '@/types'

/** CPU quantity (``500m``, ``2``, ``1.5``) in millicores. */
export function cpuToMillicores(value: string): number {
  return value.endsWith('m') ? Number(value.slice(0, -1)) : Math.round(Number(value) * 1000)
}

/** Memory quantity (``512Mi``, ``4Gi``) in MiB. */
export function memoryToMib(value: string): number {
  return value.endsWith('Gi') ? Number(value.slice(0, -2)) * 1024 : Number(value.slice(0, -2))
}

/** Millicores in the notation of appstore.yaml: ``2`` for 2000, ``500m`` for 500. */
export function formatCpu(millicores: number): string {
  return millicores % 1000 === 0 ? String(millicores / 1000) : `${millicores}m`
}

export function formatMemory(mib: number): string {
  return mib % 1024 === 0 ? `${mib / 1024}Gi` : `${mib}Mi`
}

/** The values a slider offers: from ``min`` to ``max`` in ``step`` units, always including both ends. */
export function steps(min: number, max: number, step: number): number[] {
  const out: number[] = []
  for (let v = min; v < max; v += step) out.push(v)
  out.push(max)
  return out
}

export const CPU_STEP_MILLICORES = 500
export const MEMORY_STEP_MIB = 512

/** The defaults of every choice the app offers: what a deployment gets if nobody changes anything. */
export function defaultSelection(choices: ResourceChoice[]): Record<string, { cpu: string; memory: string }> {
  return Object.fromEntries(choices.map((c) => [c.container, { cpu: c.cpu.default, memory: c.memory.default }]))
}

/** Memory as people say it: ``8`` for 8192 MiB, ``1.5`` for 1536 (Windows calls GiB "GB"). The payload stays in ``Gi``. */
export function formatMemoryGb(mib: number): string {
  const gb = mib / 1024
  return Number.isInteger(gb) ? String(gb) : String(Math.round(gb * 10) / 10)
}

type Selection = Record<string, { cpu: string; memory: string }>

/** What a container is set to: the choice made, else the recommendation of the app. */
function chosenOf(choice: ResourceChoice, selection: Selection): { cpu: string; memory: string } {
  return selection[choice.container] ?? { cpu: choice.cpu.default, memory: choice.memory.default }
}

/** Whether nothing differs from the recommendation (quantities are compared, not spellings). */
export function isDefaultSelection(choices: ResourceChoice[], selection: Selection): boolean {
  return choices.every((c) => {
    const v = chosenOf(c, selection)
    return cpuToMillicores(v.cpu) === cpuToMillicores(c.cpu.default) && memoryToMib(v.memory) === memoryToMib(c.memory.default)
  })
}

/** What all containers get together. */
export function totalResources(choices: ResourceChoice[], selection: Selection): { cpuMillicores: number; memoryMib: number } {
  return choices.reduce(
    (sum, c) => {
      const v = chosenOf(c, selection)
      return { cpuMillicores: sum.cpuMillicores + cpuToMillicores(v.cpu), memoryMib: sum.memoryMib + memoryToMib(v.memory) }
    },
    { cpuMillicores: 0, memoryMib: 0 },
  )
}

/** Remaining time as a short phrase part: ``15`` minutes, or hours and minutes; ``null`` below one minute. */
export function etaParts(seconds: number): { hours: number; minutes: number } | null {
  if (seconds < 60) return null
  const total = Math.round(seconds / 60)
  return { hours: Math.floor(total / 60), minutes: total % 60 }
}
