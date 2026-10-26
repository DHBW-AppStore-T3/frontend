import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'

import {
  useDeploymentPhases,
  DEFAULT_PHASE_COUNT,
} from '@/composables/useDeploymentPhases'
import type { Task } from '@/types'

// This logic used to sit inside DeploymentDetailView, where the only way
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
  return renderHook(() =>
    useDeploymentPhases({
      streamTotalPhases: over.totalPhases ?? 0,
      streamPhaseNames: over.phaseNames ?? null,
      streamCurrentPhaseIndex: over.currentPhaseIndex ?? null,
      streamProgress: over.progress ?? null,
      activeTask: over.activeTask ?? null,
    }),
  ).result.current
}

describe('phaseStepCount', () => {
  it('falls back to the default width before the first progress event', () => {
    expect(setup({ totalPhases: 0 }).phaseStepCount).toBe(DEFAULT_PHASE_COUNT)
  })

  it("uses the worker's reported total once it arrives", () => {
    expect(setup({ totalPhases: 17 }).phaseStepCount).toBe(17)
  })
})

describe('phaseStepLabel', () => {
  it("prefers the worker's phase names over every static table", () => {
    const { phaseStepLabel } = setup({
      totalPhases: 3,
      phaseNames: ['STARTING', 'DEPLOYING', 'CLEANUP'],
      activeTask: task({ type: 'deploy' }),
    })

    expect(phaseStepLabel(0)).toBe('Starting')
    expect(phaseStepLabel(1)).toBe('Deploying')
  })

  it('picks the deploy table by task type when no phase names have arrived', () => {
    const deploy = setup({ totalPhases: 7, activeTask: task({ type: 'deploy' }) })
    expect(deploy.phaseStepLabel(2)).toBe('K8s Namespace')
  })

  it('distinguishes pause from destroy by task type', () => {
    const pause = setup({ totalPhases: 3, activeTask: task({ type: 'pause' }) })
    const destroy = setup({ totalPhases: 4, activeTask: task({ type: 'destroy' }) })

    expect(pause.phaseStepLabel(1)).toBe('K8s Scale Down')
    expect(destroy.phaseStepLabel(1)).toBe('K8s Delete')
  })

  it('falls back to a 1-based slot number for an unrecognised width', () => {
    // No static table matches this width; the numbered slot keeps the
    // stepper from collapsing until phase_names land on the first event.
    const { phaseStepLabel } = setup({ totalPhases: 14, activeTask: task({ type: 'deploy' }) })
    expect(phaseStepLabel(12)).toBe('13')
  })

  it('still resolves the deploy table by length when no task type is known', () => {
    const { phaseStepLabel } = setup({ totalPhases: 7, activeTask: null })
    expect(phaseStepLabel(0)).toBe('Starting')
  })
})

describe('phaseLabel', () => {
  it('title-cases an underscored phase name', () => {
    expect(setup().phaseLabel('K8S_WAIT_READY')).toBe('K8s Wait Ready')
  })

  it('returns an empty string for anything that is not a phase', () => {
    expect(setup().phaseLabel('')).toBe('')
    expect(setup().phaseLabel(null)).toBe('')
    expect(setup().phaseLabel(42)).toBe('')
  })
})

describe('currentPhaseIndex', () => {
  it('is -1 before anything has been reported', () => {
    expect(setup().currentPhaseIndex).toBe(-1)
  })

  it("converts the worker's 1-based index to a 0-based dot", () => {
    expect(setup({ currentPhaseIndex: 3 }).currentPhaseIndex).toBe(2)
  })

  it('derives a dot from percent only when no index has arrived', () => {
    // 50% of 7 dots -> round(3.5) - 1 = 3
    expect(setup({ progress: 50, totalPhases: 7 }).currentPhaseIndex).toBe(3)
  })

  it('clamps a derived dot into range', () => {
    expect(setup({ progress: 0, totalPhases: 7 }).currentPhaseIndex).toBe(0)
    expect(setup({ progress: 100, totalPhases: 7 }).currentPhaseIndex).toBe(6)
    expect(setup({ progress: 900, totalPhases: 7 }).currentPhaseIndex).toBe(6)
    expect(setup({ progress: -50, totalPhases: 7 }).currentPhaseIndex).toBe(0)
  })

  it('ignores a zero index, which the worker never emits', () => {
    // phase_index is 1-based; 0 means "unset" and must not read as dot -1.
    expect(setup({ currentPhaseIndex: 0, progress: 50, totalPhases: 7 }).currentPhaseIndex)
      .toBe(3)
  })
})
