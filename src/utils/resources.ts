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
