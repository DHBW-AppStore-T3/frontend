import { describe, it, expect } from 'vitest'
import { ref } from 'vue'

import {
  useDeploymentPhases,
  DEFAULT_PHASE_COUNT,
} from '@/composables/useDeploymentPhases'
import type { Task } from '@/types'

// This logic used to sit inside DeploymentDetailView.vue, where the only way
// to reach it was to mount a ~2590-line component -- so it was never tested
// directly. The label resolution has three tiers and a length-matching
// fallback, which is exactly the kind of thing that quietly rots.

const task = (over: Partial<Task> = {}) => ({
  taskId: 't-1',
  type: 'deploy',
  status: 'running',
  created_at: '2026-06-01T00:00:00Z',
  ...over,
}) as unknown as Task

function setup(over: {
  totalPhases?: number
  phaseNames?: string[] | null
  currentPhaseIndex?: number | null
  progress?: number | null
  activeTask?: Task | null
} = {}) {
  return useDeploymentPhases({
    streamTotalPhases: ref(over.totalPhases ?? 0),
    streamPhaseNames: ref(over.phaseNames ?? null),
    streamCurrentPhaseIndex: ref(over.currentPhaseIndex ?? null),
    streamProgress: ref(over.progress ?? null),
    activeTask: ref(over.activeTask ?? null),
  })
}

describe('phaseStepCount', () => {
  it('falls back to the default width before the first progress event', () => {
    expect(setup({ totalPhases: 0 }).phaseStepCount.value).toBe(DEFAULT_PHASE_COUNT)
  })

  it("uses the worker's reported total once it arrives", () => {
    expect(setup({ totalPhases: 17 }).phaseStepCount.value).toBe(17)
  })
})

describe('phaseStepLabel', () => {
  it("prefers the worker's phase names over every static table", () => {
    const { phaseStepLabel } = setup({
      totalPhases: 3,
      phaseNames: ['STARTING', 'PACKER_BUILD:database', 'CLEANUP'],
      activeTask: task({ type: 'deploy' }),
    })

    expect(phaseStepLabel(0)).toBe('Starting')
    // Multi-image builds suffix the template key; it renders bracketed.
    expect(phaseStepLabel(1)).toBe('Packer Build [database]')
  })

  it('picks the deploy table by length when no phase names have arrived', () => {
    const full = setup({ totalPhases: 11, activeTask: task({ type: 'deploy' }) })
    expect(full.phaseStepLabel(4)).toBe('Packer Init')

    const noPacker = setup({ totalPhases: 8, activeTask: task({ type: 'deploy' }) })
    expect(noPacker.phaseStepLabel(4)).toBe('Terraform Init')
  })

  it('distinguishes pause from destroy, which have the same length', () => {
    // Both tables are 7 long, so this can only come from the task type.
    const pause = setup({ totalPhases: 7, activeTask: task({ type: 'pause' }) })
    const destroy = setup({ totalPhases: 7, activeTask: task({ type: 'destroy' }) })

    expect(pause.phaseStepLabel(5)).toBe('Server Stop')
    expect(destroy.phaseStepLabel(5)).toBe('Terraform Destroy')
  })

  it('falls back to a 1-based slot number for an unrecognised width', () => {
    // A multi-image deploy reports 14/17/... -- no static table matches, and
    // the numbered slot keeps the stepper from collapsing until phase_names
    // land on the first progress event.
    const { phaseStepLabel } = setup({ totalPhases: 14, activeTask: task({ type: 'deploy' }) })
    expect(phaseStepLabel(12)).toBe('13')
  })

  it('still resolves a known width when the task type is not known yet', () => {
    const { phaseStepLabel } = setup({ totalPhases: 11, activeTask: null })
    expect(phaseStepLabel(0)).toBe('Starting')
  })
})

describe('phaseLabel', () => {
  it('title-cases an underscored phase name', () => {
    expect(setup().phaseLabel('TERRAFORM_APPLY')).toBe('Terraform Apply')
  })

  it('renders a multi-image template key in brackets', () => {
    expect(setup().phaseLabel('PACKER_BUILD:web')).toBe('Packer Build [web]')
  })

  it('returns an empty string for anything that is not a phase', () => {
    expect(setup().phaseLabel('')).toBe('')
    expect(setup().phaseLabel(null)).toBe('')
    expect(setup().phaseLabel(42)).toBe('')
  })
})

describe('currentPhaseIndex', () => {
  it('is -1 before anything has been reported', () => {
    expect(setup().currentPhaseIndex.value).toBe(-1)
  })

  it("converts the worker's 1-based index to a 0-based dot", () => {
    expect(setup({ currentPhaseIndex: 3 }).currentPhaseIndex.value).toBe(2)
  })

  it('derives a dot from percent only when no index has arrived', () => {
    // 50% of 11 dots -> round(5.5) - 1 = 5
    expect(setup({ progress: 50, totalPhases: 11 }).currentPhaseIndex.value).toBe(5)
  })

  it('clamps a derived dot into range', () => {
    expect(setup({ progress: 0, totalPhases: 11 }).currentPhaseIndex.value).toBe(0)
    expect(setup({ progress: 100, totalPhases: 11 }).currentPhaseIndex.value).toBe(10)
    expect(setup({ progress: 900, totalPhases: 11 }).currentPhaseIndex.value).toBe(10)
    expect(setup({ progress: -50, totalPhases: 11 }).currentPhaseIndex.value).toBe(0)
  })

  it('ignores a zero index, which the worker never emits', () => {
    // phase_index is 1-based; 0 means "unset" and must not read as dot -1.
    expect(setup({ currentPhaseIndex: 0, progress: 50, totalPhases: 11 }).currentPhaseIndex.value)
      .toBe(5)
  })
})
